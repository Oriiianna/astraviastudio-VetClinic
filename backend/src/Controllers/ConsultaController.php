<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Consulta;
use App\Models\Paciente;
use App\Models\Sanidad;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Historial clinico: consultas y sus recetas.
 *
 * El acceso completo a este modulo esta limitado a admin y veterinario (ver
 * routes/api.php). La recepcion no debe leer ni escribir diagnosticos.
 */
final class ConsultaController
{
    private Consulta $consultas;
    private Paciente $pacientes;
    private Sanidad $sanidad;

    public function __construct(Consulta $consultas, Paciente $pacientes, Sanidad $sanidad)
    {
        $this->consultas = $consultas;
        $this->pacientes = $pacientes;
        $this->sanidad   = $sanidad;
    }

    /** GET /api/consultas?paciente_id=&veterinario_id=&desde=&hasta=&q=&page= */
    public function index(Request $request, Response $response): Response
    {
        $page    = Peticion::queryInt($request, 'page', 1);
        $perPage = Peticion::queryInt($request, 'per_page', 20);

        $pacienteId    = Peticion::queryInt($request, 'paciente_id', 0);
        $veterinarioId = Peticion::queryInt($request, 'veterinario_id', 0);

        $resultado = $this->consultas->listar(
            $pacienteId > 0 ? $pacienteId : null,
            $veterinarioId > 0 ? $veterinarioId : null,
            Peticion::queryString($request, 'desde'),
            Peticion::queryString($request, 'hasta'),
            Peticion::queryString($request, 'q'),
            $page,
            $perPage
        );

        return ApiResponse::paginated(
            $response,
            $resultado['items'],
            $resultado['total'],
            max(1, $page),
            max(1, min($perPage, 100))
        );
    }

    /** GET /api/consultas/{id} */
    public function show(Request $request, Response $response, array $args): Response
    {
        $consulta = $this->consultas->buscarCompleto((int) $args['id']);

        if ($consulta === null) {
            throw ApiException::notFound('La consulta');
        }

        return ApiResponse::success($response, $consulta);
    }

    /**
     * GET /api/pacientes/{id}/historial
     *
     * Linea de tiempo completa del paciente: consultas, vacunas y
     * desparasitaciones en una sola respuesta. Es como se lee una historia
     * clinica -de corrido- y evita tres peticiones al abrir la pantalla.
     */
    public function historialPaciente(Request $request, Response $response, array $args): Response
    {
        $pacienteId = (int) $args['id'];

        $paciente = $this->pacientes->buscarCompleto($pacienteId);

        if ($paciente === null) {
            throw ApiException::notFound('El paciente');
        }

        $consultas = $this->consultas->listar($pacienteId, null, null, null, null, 1, 100);

        // Las recetas se adjuntan a cada consulta: en la linea de tiempo se
        // muestran juntas y pedirlas por separado seria una peticion por fila.
        $items = array_map(
            function (array $c): array {
                $c['recetas'] = $this->consultas->recetasDe((int) $c['id']);

                return $c;
            },
            $consultas['items']
        );

        return ApiResponse::success($response, [
            'paciente'          => $paciente,
            'consultas'         => $items,
            'vacunas'           => $this->sanidad->listarPorPaciente(Sanidad::VACUNA, $pacienteId),
            'desparasitaciones' => $this->sanidad->listarPorPaciente(Sanidad::DESPARASITACION, $pacienteId),
        ]);
    }

    /** POST /api/consultas */
    public function store(Request $request, Response $response): Response
    {
        $body = Peticion::body($request);

        $datos = $this->validar($body);

        // El veterinario que firma la consulta es SIEMPRE el usuario
        // autenticado: aceptarlo del body permitiria firmar a nombre de otro.
        $datos['veterinario_id'] = (int) $request->getAttribute('usuario_id');

        $this->verificarPaciente((int) $datos['paciente_id']);

        $recetas = $this->validarRecetas($body['recetas'] ?? []);

        $id = $this->consultas->crearConRecetas($datos, $recetas);

        return ApiResponse::success(
            $response,
            $this->consultas->buscarCompleto($id),
            'Consulta registrada.',
            201
        );
    }

    /** PUT /api/consultas/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id   = (int) $args['id'];
        $body = Peticion::body($request);

        $existente = $this->consultas->buscarPorId($id);

        if ($existente === null) {
            throw ApiException::notFound('La consulta');
        }

        $rol = (string) $request->getAttribute('usuario_rol');
        $yo  = (int) $request->getAttribute('usuario_id');

        // Un veterinario solo edita lo que firmo. El admin puede corregir
        // cualquier registro.
        if ($rol !== 'admin' && (int) $existente['veterinario_id'] !== $yo) {
            throw ApiException::forbidden('Solo podes editar las consultas que registraste vos.');
        }

        $datos = $this->validar($body);
        $this->verificarPaciente((int) $datos['paciente_id']);

        // `recetas` ausente = no tocarlas; presente (aunque vacio) = reemplazar.
        $recetas = array_key_exists('recetas', $body)
            ? $this->validarRecetas($body['recetas'] ?? [])
            : null;

        $this->consultas->actualizarConRecetas($id, $datos, $recetas);

        return ApiResponse::success(
            $response,
            $this->consultas->buscarCompleto($id),
            'Consulta actualizada.'
        );
    }

    /**
     * DELETE /api/consultas/{id}
     *
     * Solo admin (ver routes). Borrar un registro medico deberia ser
     * excepcional: lo normal es corregirlo, no eliminarlo.
     */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if ($this->consultas->buscarPorId($id) === null) {
            throw ApiException::notFound('La consulta');
        }

        // Las recetas caen por CASCADE; vacunas y desparasitaciones quedan
        // con consulta_id en NULL (ON DELETE SET NULL), conservandose.
        $this->consultas->eliminar($id);

        return ApiResponse::success($response, null, 'Consulta eliminada.');
    }

    // ------------------------------------------------------------------ //

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validar(array $body): array
    {
        $datos = (new Validator($body))
            ->required('paciente_id')->numeric('paciente_id', 1)
            ->required('motivo')->maxLen('motivo', 200)
            ->optional('turno_id')->numeric('turno_id', 1)
            ->optional('fecha')
            ->optional('anamnesis')->maxLen('anamnesis', 5000)
            ->optional('examen_fisico')->maxLen('examen_fisico', 5000)
            ->optional('peso_kg')->numeric('peso_kg', 0.01, 900)
            ->optional('temperatura_c')->numeric('temperatura_c', 20, 45)
            ->optional('frecuencia_cardiaca')->numeric('frecuencia_cardiaca', 0, 400)
            ->optional('frecuencia_respiratoria')->numeric('frecuencia_respiratoria', 0, 300)
            ->optional('diagnostico')->maxLen('diagnostico', 5000)
            ->optional('tratamiento')->maxLen('tratamiento', 5000)
            ->optional('observaciones')->maxLen('observaciones', 5000)
            ->optional('proximo_control')->date('proximo_control')
            ->validate();

        if (empty($datos['fecha'])) {
            $datos['fecha'] = date('Y-m-d H:i:s');
        }

        return $datos;
    }

    /**
     * @param mixed $recetas
     * @return array<int,array<string,mixed>>
     */
    private function validarRecetas($recetas): array
    {
        if (!is_array($recetas)) {
            return [];
        }

        $vias    = ['oral', 'topica', 'inyectable', 'oftalmica', 'otica', 'otra'];
        $limpias = [];
        $errores = [];

        foreach ($recetas as $i => $receta) {
            if (!is_array($receta)) {
                continue;
            }

            // Un renglon totalmente vacio se descarta en silencio: los
            // formularios dinamicos suelen dejar uno de sobra al final.
            if (trim((string) ($receta['medicamento'] ?? '')) === '') {
                continue;
            }

            try {
                $limpias[] = (new Validator($receta))
                    ->required('medicamento')->maxLen('medicamento', 150)
                    ->required('dosis')->maxLen('dosis', 100)
                    ->required('frecuencia')->maxLen('frecuencia', 100)
                    ->optional('presentacion')->maxLen('presentacion', 100)
                    ->optional('duracion')->maxLen('duracion', 100)
                    ->optional('via')->in('via', $vias)
                    ->optional('indicaciones')->maxLen('indicaciones', 1000)
                    ->validate();
            } catch (ValidationException $e) {
                // Se prefija con el indice para que el frontend sepa que
                // renglon marcar en rojo.
                foreach ($e->getErrors() as $campo => $mensaje) {
                    $errores["recetas.$i.$campo"] = $mensaje;
                }
            }
        }

        if ($errores !== []) {
            throw new ValidationException($errores);
        }

        return $limpias;
    }

    private function verificarPaciente(int $pacienteId): void
    {
        if (!$this->pacientes->existe($pacienteId)) {
            throw new ValidationException(['paciente_id' => 'El paciente seleccionado no existe.']);
        }
    }
}
