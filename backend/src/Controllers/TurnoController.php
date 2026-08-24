<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Paciente;
use App\Models\Turno;
use App\Models\Usuario;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

/**
 * Agenda de turnos.
 */
final class TurnoController
{
    private const ESTADOS = [
        'programado', 'confirmado', 'en_sala', 'atendido', 'cancelado', 'ausente',
    ];

    private const TIPOS = [
        'consulta', 'vacunacion', 'cirugia', 'control', 'peluqueria', 'urgencia', 'otro',
    ];

    private Turno $turnos;
    private Paciente $pacientes;
    private Usuario $usuarios;

    public function __construct(Turno $turnos, Paciente $pacientes, Usuario $usuarios)
    {
        $this->turnos    = $turnos;
        $this->pacientes = $pacientes;
        $this->usuarios  = $usuarios;
    }

    /**
     * GET /api/turnos?desde=&hasta=&veterinario_id=&estado=&paciente_id=
     *
     * Sin paginar: la agenda siempre pide un rango acotado (un dia o una
     * semana) y necesita todos los turnos de ese rango para dibujarse.
     */
    public function index(Request $request, Response $response): Response
    {
        $desde = Peticion::queryString($request, 'desde', date('Y-m-d'));
        $hasta = Peticion::queryString($request, 'hasta', $desde);

        $vetId      = Peticion::queryInt($request, 'veterinario_id', 0);
        $pacienteId = Peticion::queryInt($request, 'paciente_id', 0);

        $turnos = $this->turnos->listarRango(
            $desde,
            $hasta,
            $vetId > 0 ? $vetId : null,
            Peticion::queryString($request, 'estado'),
            $pacienteId > 0 ? $pacienteId : null
        );

        return ApiResponse::success($response, $turnos);
    }

    /** GET /api/turnos/{id} */
    public function show(Request $request, Response $response, array $args): Response
    {
        $turno = $this->turnos->buscarCompleto((int) $args['id']);

        if ($turno === null) {
            throw ApiException::notFound('El turno');
        }

        return ApiResponse::success($response, $turno);
    }

    /** GET /api/veterinarios -> para el selector de la agenda */
    public function veterinarios(Request $request, Response $response): Response
    {
        return ApiResponse::success($response, $this->usuarios->veterinarios());
    }

    /** GET /api/turnos/resumen?fecha= */
    public function resumen(Request $request, Response $response): Response
    {
        return ApiResponse::success(
            $response,
            $this->turnos->resumenDelDia(Peticion::queryString($request, 'fecha'))
        );
    }

    /** POST /api/turnos */
    public function store(Request $request, Response $response): Response
    {
        $datos = $this->validar(Peticion::body($request));
        $datos['creado_por'] = (int) $request->getAttribute('usuario_id');

        // La comprobacion de solapamiento y el INSERT van en la MISMA
        // transaccion: si se validara fuera, dos peticiones simultaneas
        // podrian pasar ambas y crear el conflicto igual.
        $this->turnos->beginTransaction();

        try {
            $this->verificarRelaciones($datos);
            $this->verificarSolapamiento($datos);

            $id = $this->turnos->crear($datos);

            $this->turnos->commit();
        } catch (Throwable $e) {
            $this->turnos->rollBack();

            throw $e;
        }

        return ApiResponse::success(
            $response,
            $this->turnos->buscarCompleto($id),
            'Turno agendado.',
            201
        );
    }

    /** PUT /api/turnos/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->turnos->existe($id)) {
            throw ApiException::notFound('El turno');
        }

        $datos = $this->validar(Peticion::body($request));

        $this->turnos->beginTransaction();

        try {
            $this->verificarRelaciones($datos);
            $this->verificarSolapamiento($datos, $id);

            $this->turnos->actualizar($id, $datos);

            $this->turnos->commit();
        } catch (Throwable $e) {
            $this->turnos->rollBack();

            throw $e;
        }

        return ApiResponse::success(
            $response,
            $this->turnos->buscarCompleto($id),
            'Turno actualizado.'
        );
    }

    /**
     * PATCH /api/turnos/{id}/estado
     *
     * Endpoint aparte del update completo porque es la operacion mas frecuente
     * del dia (marcar "en sala", "atendido") y no deberia exigir reenviar el
     * turno entero.
     */
    public function cambiarEstado(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->turnos->existe($id)) {
            throw ApiException::notFound('El turno');
        }

        $datos = (new Validator(Peticion::body($request)))
            ->required('estado')->in('estado', self::ESTADOS)
            ->validate();

        $this->turnos->cambiarEstado($id, (string) $datos['estado']);

        return ApiResponse::success(
            $response,
            $this->turnos->buscarCompleto($id),
            'Estado actualizado.'
        );
    }

    /** DELETE /api/turnos/{id} */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->turnos->existe($id)) {
            throw ApiException::notFound('El turno');
        }

        $this->turnos->eliminar($id);

        return ApiResponse::success($response, null, 'Turno eliminado.');
    }

    // ------------------------------------------------------------------ //

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validar(array $body): array
    {
        // Un <input type="datetime-local"> manda "2026-08-05T09:30" (sin
        // segundos y con T). Se normaliza aqui para que el resto del sistema
        // trabaje siempre con el formato de MySQL.
        foreach (['fecha_hora_inicio', 'fecha_hora_fin'] as $campo) {
            if (empty($body[$campo]) || !is_string($body[$campo])) {
                continue;
            }

            $valor = str_replace('T', ' ', trim($body[$campo]));

            if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $valor) === 1) {
                $valor .= ':00';
            }

            $body[$campo] = $valor;
        }

        $datos = (new Validator($body))
            ->required('paciente_id')->numeric('paciente_id', 1)
            ->required('veterinario_id')->numeric('veterinario_id', 1)
            ->required('fecha_hora_inicio')->date('fecha_hora_inicio', 'Y-m-d H:i:s')
            ->required('fecha_hora_fin')->date('fecha_hora_fin', 'Y-m-d H:i:s')
            ->required('motivo')->maxLen('motivo', 200)
            ->optional('tipo')->in('tipo', self::TIPOS)
            ->optional('estado')->in('estado', self::ESTADOS)
            ->optional('notas')->maxLen('notas', 2000)
            ->validate();

        if ($datos['fecha_hora_fin'] <= $datos['fecha_hora_inicio']) {
            throw new ValidationException([
                'fecha_hora_fin' => 'El fin del turno debe ser posterior al inicio.',
            ]);
        }

        // Un turno de mas de 8 horas es casi siempre un error de carga
        // (fecha equivocada), no una cirugia larga.
        $duracion = strtotime((string) $datos['fecha_hora_fin'])
                  - strtotime((string) $datos['fecha_hora_inicio']);

        if ($duracion > 8 * 3600) {
            throw new ValidationException([
                'fecha_hora_fin' => 'La duracion no puede superar las 8 horas.',
            ]);
        }

        return $datos;
    }

    /** @param array<string,mixed> $datos */
    private function verificarRelaciones(array $datos): void
    {
        $errores = [];

        if (!$this->pacientes->existe((int) $datos['paciente_id'])) {
            $errores['paciente_id'] = 'El paciente seleccionado no existe.';
        }

        $vet = $this->usuarios->perfil((int) $datos['veterinario_id']);

        if ($vet === null || $vet['rol'] !== 'veterinario') {
            $errores['veterinario_id'] = 'El profesional seleccionado no es un veterinario activo.';
        } elseif ((int) $vet['activo'] !== 1) {
            $errores['veterinario_id'] = 'El veterinario esta deshabilitado.';
        }

        if ($errores !== []) {
            throw new ValidationException($errores);
        }
    }

    /** @param array<string,mixed> $datos */
    private function verificarSolapamiento(array &$datos, ?int $exceptoId = null): void
    {
        // cliente_id se DERIVA del paciente en vez de aceptarlo del body: asi
        // es imposible guardar un turno cuyo dueno no sea el de la mascota.
        $paciente = $this->pacientes->buscarCompleto((int) $datos['paciente_id']);
        $datos['cliente_id'] = $paciente['cliente_id'];

        $choques = $this->turnos->solapados(
            (int) $datos['veterinario_id'],
            (string) $datos['fecha_hora_inicio'],
            (string) $datos['fecha_hora_fin'],
            $exceptoId
        );

        if ($choques === []) {
            return;
        }

        $detalle = implode(', ', array_map(
            static fn (array $t): string => sprintf(
                '%s (%s a %s)',
                $t['paciente_nombre'],
                substr((string) $t['fecha_hora_inicio'], 11, 5),
                substr((string) $t['fecha_hora_fin'], 11, 5)
            ),
            $choques
        ));

        throw new ValidationException(
            ['fecha_hora_inicio' => "El veterinario ya tiene un turno en ese horario: $detalle."],
            'El horario se superpone con otro turno.'
        );
    }
}
