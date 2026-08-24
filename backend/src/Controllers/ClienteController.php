<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Cliente;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * CRUD de clientes (duenos).
 *
 * Este controlador es la PLANTILLA del proyecto. Los modulos de Pacientes,
 * Historial y Turnos se escriben calcando esta estructura:
 *
 *   1. Validar y filtrar la entrada con Validator (whitelist de campos).
 *   2. Delegar el SQL al modelo, que solo usa sentencias preparadas.
 *   3. Responder siempre con ApiResponse.
 *   4. Lanzar ApiException / ValidationException; el JsonErrorHandler
 *      las convierte en la respuesta HTTP correspondiente.
 */
final class ClienteController
{
    private Cliente $clientes;

    public function __construct(Cliente $clientes)
    {
        $this->clientes = $clientes;
    }

    /** GET /api/clientes?q=&page=&per_page=&order_by=&order_dir= */
    public function index(Request $request, Response $response): Response
    {
        $page    = Peticion::queryInt($request, 'page', 1);
        $perPage = Peticion::queryInt($request, 'per_page', 20);

        $resultado = $this->clientes->listar(
            Peticion::queryString($request, 'q'),
            $page,
            $perPage,
            Peticion::queryString($request, 'order_by', 'apellido'),
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

    /** GET /api/clientes/{id} */
    public function show(Request $request, Response $response, array $args): Response
    {
        $cliente = $this->clientes->conPacientes((int) $args['id']);

        if ($cliente === null) {
            throw ApiException::notFound('El cliente');
        }

        return ApiResponse::success($response, $cliente);
    }

    /** POST /api/clientes */
    public function store(Request $request, Response $response): Response
    {
        $datos = $this->validar(Peticion::body($request));

        if (isset($datos['documento']) && $this->clientes->documentoEnUso((string) $datos['documento'])) {
            throw new ValidationException(['documento' => 'Ya existe un cliente con ese documento.']);
        }

        $id = $this->clientes->crear($datos);

        return ApiResponse::success(
            $response,
            $this->clientes->buscarPorId($id),
            'Cliente creado correctamente.',
            201
        );
    }

    /** PUT /api/clientes/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->clientes->existe($id)) {
            throw ApiException::notFound('El cliente');
        }

        $datos = $this->validar(Peticion::body($request));

        if (isset($datos['documento']) && $this->clientes->documentoEnUso((string) $datos['documento'], $id)) {
            throw new ValidationException(['documento' => 'Ya existe otro cliente con ese documento.']);
        }

        $this->clientes->actualizar($id, $datos);

        return ApiResponse::success(
            $response,
            $this->clientes->buscarPorId($id),
            'Cliente actualizado.'
        );
    }

    /**
     * DELETE /api/clientes/{id}
     *
     * Baja logica. Se bloquea si el cliente tiene mascotas activas: borrar al
     * dueno dejaria historias clinicas huerfanas, que en un registro medico no
     * es aceptable. Primero hay que reasignar o dar de baja las mascotas.
     */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if (!$this->clientes->existe($id)) {
            throw ApiException::notFound('El cliente');
        }

        $pacientes = $this->clientes->contarPacientes($id);

        if ($pacientes > 0) {
            throw ApiException::conflict(
                "No se puede dar de baja: el cliente tiene $pacientes mascota(s) activa(s). " .
                'Da de baja o reasigna las mascotas primero.'
            );
        }

        $this->clientes->eliminar($id);

        return ApiResponse::success($response, null, 'Cliente dado de baja.');
    }

    /**
     * Reglas de validacion compartidas por store() y update().
     *
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validar(array $body): array
    {
        return (new Validator($body))
            ->required('nombre')->maxLen('nombre', 80)
            ->required('apellido')->maxLen('apellido', 80)
            ->required('telefono')->maxLen('telefono', 30)
            ->optional('documento')->maxLen('documento', 30)
            ->optional('email')->email('email')->maxLen('email', 150)
            ->optional('telefono_alt')->maxLen('telefono_alt', 30)
            ->optional('direccion')->maxLen('direccion', 200)
            ->optional('ciudad')->maxLen('ciudad', 80)
            ->optional('codigo_postal')->maxLen('codigo_postal', 20)
            ->optional('notas')->maxLen('notas', 2000)
            ->validate();
    }
}
