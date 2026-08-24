<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Adjunto;
use App\Models\Paciente;
use App\Support\Almacenamiento;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Psr7\Stream;
use Throwable;

/**
 * Documentos adjuntos de un paciente.
 *
 * La descarga pasa SIEMPRE por aqui y no por una URL estatica: son registros
 * medicos y deben exigir sesion. Es la razon por la que los archivos viven
 * fuera de public/.
 */
final class AdjuntoController
{
    private const TIPOS = ['foto', 'radiografia', 'ecografia', 'analisis', 'documento', 'otro'];

    private Adjunto $adjuntos;
    private Paciente $pacientes;
    private Almacenamiento $almacen;

    public function __construct(Adjunto $adjuntos, Paciente $pacientes, Almacenamiento $almacen)
    {
        $this->adjuntos  = $adjuntos;
        $this->pacientes = $pacientes;
        $this->almacen   = $almacen;
    }

    /** GET /api/pacientes/{id}/adjuntos */
    public function index(Request $request, Response $response, array $args): Response
    {
        $pacienteId = (int) $args['id'];

        if (!$this->pacientes->existe($pacienteId)) {
            throw ApiException::notFound('El paciente');
        }

        return ApiResponse::success($response, $this->adjuntos->listarPorPaciente($pacienteId));
    }

    /**
     * POST /api/pacientes/{id}/adjuntos   (multipart/form-data)
     *
     * Campos: archivo (file), tipo, descripcion, consulta_id
     */
    public function store(Request $request, Response $response, array $args): Response
    {
        $pacienteId = (int) $args['id'];

        if (!$this->pacientes->existe($pacienteId)) {
            throw ApiException::notFound('El paciente');
        }

        $archivos = $request->getUploadedFiles();
        $archivo  = $archivos['archivo'] ?? null;

        if ($archivo === null) {
            throw new ValidationException(['archivo' => 'No se envio ningun archivo.']);
        }

        $datos = (new Validator(Peticion::body($request)))
            ->optional('tipo')->in('tipo', self::TIPOS)
            ->optional('descripcion')->maxLen('descripcion', 255)
            ->optional('consulta_id')->numeric('consulta_id', 1)
            ->validate();

        // El archivo se guarda primero y la fila despues: si el INSERT falla,
        // se borra el binario para no dejar huerfanos en disco.
        $guardado = $this->almacen->guardar($archivo, 'paciente-' . $pacienteId);

        try {
            $id = $this->adjuntos->crear([
                'paciente_id'     => $pacienteId,
                'consulta_id'     => $datos['consulta_id'] ?? null,
                'tipo'            => $datos['tipo'] ?? 'documento',
                'ruta'            => $guardado['ruta'],
                'nombre_original' => $guardado['nombre_original'],
                'mime'            => $guardado['mime'],
                'tamano_bytes'    => $guardado['tamano'],
                'descripcion'     => $datos['descripcion'] ?? null,
                'subido_por'      => (int) $request->getAttribute('usuario_id'),
            ]);
        } catch (Throwable $e) {
            $this->almacen->eliminar($guardado['ruta']);

            throw $e;
        }

        $fila = $this->adjuntos->buscarPorId($id);
        unset($fila['ruta']); // la ruta en disco no sale nunca al cliente

        return ApiResponse::success($response, $fila, 'Documento adjuntado.', 201);
    }

    /**
     * GET /api/adjuntos/{id}/archivo
     *
     * Entrega el binario. Los tipos que el navegador puede mostrar van inline
     * (para previsualizar un PDF o una radiografia sin descargarlos); el resto
     * fuerza descarga.
     */
    public function descargar(Request $request, Response $response, array $args): Response
    {
        $adjunto = $this->adjuntos->conRuta((int) $args['id']);

        if ($adjunto === null) {
            throw ApiException::notFound('El documento');
        }

        $ruta = $this->almacen->rutaAbsoluta((string) $adjunto['ruta']);

        if ($ruta === null || !is_file($ruta)) {
            throw ApiException::notFound('El archivo');
        }

        $recurso = fopen($ruta, 'rb');

        if ($recurso === false) {
            throw ApiException::notFound('El archivo');
        }

        $inline = str_starts_with((string) $adjunto['mime'], 'image/')
            || $adjunto['mime'] === 'application/pdf';

        // El nombre se envia entre comillas y ademas codificado (RFC 5987)
        // para que los acentos no rompan la cabecera.
        $nombre = (string) $adjunto['nombre_original'];

        return $response
            ->withBody(new Stream($recurso))
            ->withHeader('Content-Type', (string) $adjunto['mime'])
            ->withHeader('Content-Length', (string) $adjunto['tamano_bytes'])
            ->withHeader(
                'Content-Disposition',
                sprintf(
                    '%s; filename="%s"; filename*=UTF-8\'\'%s',
                    $inline ? 'inline' : 'attachment',
                    preg_replace('/[^\w .\-]/', '_', $nombre),
                    rawurlencode($nombre)
                )
            )
            // Registro medico: que no quede en caches intermedias.
            ->withHeader('Cache-Control', 'private, no-store')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }

    /** PUT /api/adjuntos/{id} — solo metadatos (tipo y descripcion). */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if ($this->adjuntos->conRuta($id) === null) {
            throw ApiException::notFound('El documento');
        }

        $datos = (new Validator(Peticion::body($request)))
            ->optional('tipo')->in('tipo', self::TIPOS)
            ->optional('descripcion')->maxLen('descripcion', 255)
            ->validate();

        $this->adjuntos->actualizar($id, $datos);

        $fila = $this->adjuntos->buscarPorId($id);
        unset($fila['ruta']);

        return ApiResponse::success($response, $fila, 'Documento actualizado.');
    }

    /** DELETE /api/adjuntos/{id} */
    public function destroy(Request $request, Response $response, array $args): Response
    {
        $adjunto = $this->adjuntos->conRuta((int) $args['id']);

        if ($adjunto === null) {
            throw ApiException::notFound('El documento');
        }

        // Primero la fila: si se borrara el archivo y fallara el DELETE, el
        // registro quedaria apuntando a un binario inexistente.
        $this->adjuntos->eliminar((int) $adjunto['id']);
        $this->almacen->eliminar((string) $adjunto['ruta']);

        return ApiResponse::success($response, null, 'Documento eliminado.');
    }
}
