<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Catalogo;
use App\Models\Cliente;
use App\Models\Paciente;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * CRUD de pacientes (mascotas).
 *
 * Sigue la misma estructura que ClienteController: validar con whitelist,
 * delegar el SQL al modelo, responder con ApiResponse y lanzar
 * ApiException/ValidationException para que el JsonErrorHandler las traduzca.
 */
final class PacienteController
{
    private Paciente $pacientes;
    private Cliente $clientes;
    private Catalogo $catalogo;

    public function __construct(Paciente $pacientes, Cliente $clientes, Catalogo $catalogo)
    {
        $this->pacientes = $pacientes;
        $this->clientes  = $clientes;
        $this->catalogo  = $catalogo;
    }

    /** GET /api/pacientes?q=&cliente_id=&especie_id=&incluir_fallecidos=&page=&per_page= */
    public function index(Request $request, Response $response): Response
    {
        $page    = Peticion::queryInt($request, 'page', 1);
        $perPage = Peticion::queryInt($request, 'per_page', 20);

        $clienteId = Peticion::queryInt($request, 'cliente_id', 0);
        $especieId = Peticion::queryInt($request, 'especie_id', 0);

        $resultado = $this->pacientes->listar(
            Peticion::queryString($request, 'q'),
            $clienteId > 0 ? $clienteId : null,
            $especieId > 0 ? $especieId : null,
            Peticion::queryString($request, 'incluir_fallecidos') === '1',
            $page,
            $perPage,
            Peticion::queryString($request, 'order_by', 'nombre'),
            Peticion::queryString($request, 'order_dir', 'ASC')
        );

        return ApiResponse::paginated(
            $response,
            $resultado['items'],
            $resultado['total'],
            max(1, $page),
            max(1, min($perPage, 100))
        );
    }

    /** GET /api/pacientes/{id} */
    public function show(Request $request, Response $response, array $args): Response
    {
        $paciente = $this->pacientes->buscarCompleto((int) $args['id']);

        if ($paciente === null) {
            throw ApiException::notFound('El paciente');
        }

        // El historial de pesos viaja con la ficha: es un unico grafico y
        // evita una segunda peticion al abrir el detalle.
        $paciente['historial_peso'] = $this->pacientes->historialPeso((int) $args['id']);

        return ApiResponse::success($response, $paciente);
    }

    /** GET /api/especies -> catalogo con razas anidadas */
    public function especies(Request $request, Response $response): Response
    {
        return ApiResponse::success($response, $this->catalogo->especiesConRazas());
    }

    /** POST /api/pacientes */
    public function store(Request $request, Response $response): Response
    {
        $datos = $this->validar(Peticion::body($request));
        $this->verificarRelaciones($datos);

        $id = $this->pacientes->crear($datos);

        return ApiResponse::success(
            $response,
            $this->pacientes->buscarCompleto($id),
            'Paciente creado correctamente.',
            201
        );
    }

    /** PUT /api/pacientes/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->pacientes->existe($id)) {
            throw ApiException::notFound('El paciente');
        }

        $datos = $this->validar(Peticion::body($request));
        $this->verificarRelaciones($datos, $id);

        $this->pacientes->actualizar($id, $datos);

        return ApiResponse::success(
            $response,
            $this->pacientes->buscarCompleto($id),
            'Paciente actualizado.'
        );
    }

    /**
     * DELETE /api/pacientes/{id}
     *
     * Baja logica. Se bloquea si el paciente tiene consultas registradas: el
     * historial clinico es un registro medico y no debe quedar apuntando a
     * una ficha oculta. Para un animal que murio esta `fallecido`, que
     * conserva la ficha y su historial visibles.
     */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->pacientes->existe($id)) {
            throw ApiException::notFound('El paciente');
        }

        $consultas = $this->pacientes->contarConsultas($id);

        if ($consultas > 0) {
            throw ApiException::conflict(
                "No se puede eliminar: el paciente tiene $consultas consulta(s) en su historial clinico. " .
                'Si el animal falleció, marcalo como fallecido en lugar de eliminarlo.'
            );
        }

        $this->pacientes->eliminar($id);

        return ApiResponse::success($response, null, 'Paciente dado de baja.');
    }

    /**
     * Reglas compartidas por store() y update().
     *
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validar(array $body): array
    {
        // Los checkbox llegan como booleanos de JSON; la columna es TINYINT.
        foreach (['esterilizado', 'fallecido'] as $flag) {
            if (array_key_exists($flag, $body)) {
                $body[$flag] = filter_var($body[$flag], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            }
        }

        $datos = (new Validator($body))
            ->required('cliente_id')->numeric('cliente_id', 1)
            ->required('nombre')->maxLen('nombre', 80)
            ->required('especie_id')->numeric('especie_id', 1)
            ->optional('raza_id')->numeric('raza_id', 1)
            ->optional('sexo')->in('sexo', ['macho', 'hembra', 'desconocido'])
            ->optional('fecha_nacimiento')->date('fecha_nacimiento')
            // 900 kg cubre a un equino adulto; por arriba es un error de carga.
            ->optional('peso_kg')->numeric('peso_kg', 0.01, 900)
            ->optional('color')->maxLen('color', 60)
            ->optional('microchip')->maxLen('microchip', 50)
            ->optional('esterilizado')
            ->optional('alergias')->maxLen('alergias', 2000)
            ->optional('observaciones')->maxLen('observaciones', 2000)
            ->optional('fallecido')
            ->optional('fecha_fallecimiento')->date('fecha_fallecimiento')
            ->validate();

        $errores = [];

        // Una fecha de nacimiento futura pasa el formato pero no tiene
        // sentido, y romperia el calculo de edad del frontend.
        if (!empty($datos['fecha_nacimiento']) && $datos['fecha_nacimiento'] > date('Y-m-d')) {
            $errores['fecha_nacimiento'] = 'La fecha de nacimiento no puede ser futura.';
        }

        if (!empty($datos['fecha_fallecimiento'])) {
            if ($datos['fecha_fallecimiento'] > date('Y-m-d')) {
                $errores['fecha_fallecimiento'] = 'La fecha de fallecimiento no puede ser futura.';
            } elseif (
                !empty($datos['fecha_nacimiento'])
                && $datos['fecha_fallecimiento'] < $datos['fecha_nacimiento']
            ) {
                $errores['fecha_fallecimiento'] = 'No puede ser anterior a la fecha de nacimiento.';
            }
        }

        if ($errores !== []) {
            throw new ValidationException($errores);
        }

        return $datos;
    }

    /**
     * Comprueba la coherencia de las claves foraneas ANTES de tocar la base,
     * para devolver un 422 con el campo exacto en vez de un error de FK.
     *
     * @param array<string,mixed> $datos
     */
    private function verificarRelaciones(array $datos, ?int $exceptoId = null): void
    {
        $errores = [];

        if (!$this->clientes->existe((int) $datos['cliente_id'])) {
            $errores['cliente_id'] = 'El dueno seleccionado no existe.';
        }

        if (!$this->catalogo->especieExiste((int) $datos['especie_id'])) {
            $errores['especie_id'] = 'La especie seleccionada no existe.';
        } elseif (
            !empty($datos['raza_id'])
            && !$this->pacientes->razaPerteneceAEspecie((int) $datos['raza_id'], (int) $datos['especie_id'])
        ) {
            $errores['raza_id'] = 'La raza no corresponde a la especie seleccionada.';
        }

        if (
            !empty($datos['microchip'])
            && $this->pacientes->microchipEnUso((string) $datos['microchip'], $exceptoId)
        ) {
            $errores['microchip'] = 'Ya existe otro paciente con ese microchip.';
        }

        if ($errores !== []) {
            throw new ValidationException($errores);
        }
    }
}
