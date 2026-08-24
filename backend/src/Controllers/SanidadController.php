<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Paciente;
use App\Models\Sanidad;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Vacunas y desparasitaciones.
 *
 * Un solo controlador para ambas: comparten estructura y reglas, y el tipo
 * llega como argumento de la ruta. Duplicar la clase solo para cambiar dos
 * nombres de campo agregaria mantenimiento sin agregar claridad.
 */
final class SanidadController
{
    private Sanidad $sanidad;
    private Paciente $pacientes;

    public function __construct(Sanidad $sanidad, Paciente $pacientes)
    {
        $this->sanidad   = $sanidad;
        $this->pacientes = $pacientes;
    }

    /** GET /api/pacientes/{id}/vacunas | /desparasitaciones */
    public function index(Request $request, Response $response, array $args): Response
    {
        $tipo = $this->tipoDesdeRuta($request);

        if (!$this->pacientes->existe((int) $args['id'])) {
            throw ApiException::notFound('El paciente');
        }

        return ApiResponse::success(
            $response,
            $this->sanidad->listarPorPaciente($tipo, (int) $args['id'])
        );
    }

    /** POST /api/vacunas | /api/desparasitaciones */
    public function store(Request $request, Response $response): Response
    {
        $tipo  = $this->tipoDesdeRuta($request);
        $datos = $this->validar($tipo, Peticion::body($request));

        // Igual que en consultas: firma el usuario autenticado.
        $datos['veterinario_id'] = (int) $request->getAttribute('usuario_id');

        if (!$this->pacientes->existe((int) $datos['paciente_id'])) {
            throw new ValidationException(['paciente_id' => 'El paciente seleccionado no existe.']);
        }

        $id = $this->sanidad->crear($tipo, $datos);

        return ApiResponse::success(
            $response,
            $this->sanidad->buscarPorId($tipo, $id),
            $tipo === Sanidad::VACUNA ? 'Vacuna registrada.' : 'Desparasitacion registrada.',
            201
        );
    }

    /** PUT /api/vacunas/{id} | /api/desparasitaciones/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $tipo = $this->tipoDesdeRuta($request);
        $id   = (int) $args['id'];

        if ($this->sanidad->buscarPorId($tipo, $id) === null) {
            throw ApiException::notFound('El registro');
        }

        $datos = $this->validar($tipo, Peticion::body($request));

        $this->sanidad->actualizar($tipo, $id, $datos);

        return ApiResponse::success(
            $response,
            $this->sanidad->buscarPorId($tipo, $id),
            'Registro actualizado.'
        );
    }

    /** DELETE /api/vacunas/{id} | /api/desparasitaciones/{id} */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $tipo = $this->tipoDesdeRuta($request);
        $id   = (int) $args['id'];

        if ($this->sanidad->buscarPorId($tipo, $id) === null) {
            throw ApiException::notFound('El registro');
        }

        $this->sanidad->eliminar($tipo, $id);

        return ApiResponse::success($response, null, 'Registro eliminado.');
    }

    /**
     * GET /api/recordatorios?dias=30
     *
     * Vacunas y desparasitaciones vencidas o proximas a vencer. Es la fuente
     * de datos que despues usaran las notificaciones push.
     */
    public function recordatorios(Request $request, Response $response): Response
    {
        $dias = Peticion::queryInt($request, 'dias', 30);

        return ApiResponse::success($response, $this->sanidad->recordatorios($dias));
    }

    // ------------------------------------------------------------------ //

    /**
     * El tipo se deduce del path para no repetir el controlador. Se lee de la
     * URI y no de un parametro del cliente: asi no se puede pedir una
     * operacion sobre otra tabla manipulando el body.
     */
    private function tipoDesdeRuta(Request $request): string
    {
        return str_contains($request->getUri()->getPath(), 'desparasitacion')
            ? Sanidad::DESPARASITACION
            : Sanidad::VACUNA;
    }

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validar(string $tipo, array $body): array
    {
        $v = (new Validator($body))
            ->required('paciente_id')->numeric('paciente_id', 1)
            ->required('fecha_aplicacion')->date('fecha_aplicacion')
            ->optional('consulta_id')->numeric('consulta_id', 1)
            ->optional('fecha_proxima')->date('fecha_proxima')
            ->optional('observaciones')->maxLen('observaciones', 2000);

        if ($tipo === Sanidad::VACUNA) {
            $v->required('tipo_vacuna')->maxLen('tipo_vacuna', 120)
              ->optional('marca')->maxLen('marca', 100)
              ->optional('lote')->maxLen('lote', 80);
        } else {
            $v->required('producto')->maxLen('producto', 120)
              ->optional('tipo')->in('tipo', ['interna', 'externa', 'mixta'])
              ->optional('via')->in('via', ['oral', 'topica', 'inyectable'])
              ->optional('dosis')->maxLen('dosis', 100);
        }

        $datos = $v->validate();

        $errores = [];

        if ($datos['fecha_aplicacion'] > date('Y-m-d')) {
            $errores['fecha_aplicacion'] = 'La fecha de aplicacion no puede ser futura.';
        }

        // La proxima dosis es, por definicion, posterior a la aplicada.
        if (
            !empty($datos['fecha_proxima'])
            && $datos['fecha_proxima'] <= $datos['fecha_aplicacion']
        ) {
            $errores['fecha_proxima'] = 'La proxima dosis debe ser posterior a la fecha de aplicacion.';
        }

        if ($errores !== []) {
            throw new ValidationException($errores);
        }

        return $datos;
    }
}
