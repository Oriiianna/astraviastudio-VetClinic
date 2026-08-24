<?php

declare(strict_types=1);

namespace App\Support;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * Forma unica de respuesta de toda la API.
 *
 *   { "success": bool, "data": mixed|null, "message": string|null, "errors": object|null }
 *
 * Tener una sola forma permite que el cliente HTTP del frontend
 * (src/api/client.js) desempaquete siempre igual, sin condicionales por
 * endpoint.
 */
final class ApiResponse
{
    /** @param mixed $data */
    public static function success(Response $response, $data = null, ?string $message = null, int $status = 200): Response
    {
        return self::write($response, [
            'success' => true,
            'data'    => $data,
            'message' => $message,
            'errors'  => null,
        ], $status);
    }

    /** @param array<string,mixed>|null $errors */
    public static function error(Response $response, string $message, int $status = 400, ?array $errors = null): Response
    {
        return self::write($response, [
            'success' => false,
            'data'    => null,
            'message' => $message,
            'errors'  => $errors,
        ], $status);
    }

    /**
     * Respuesta paginada. `meta` viaja fuera de `data` para que el consumidor
     * pueda iterar `data` directamente como una lista.
     *
     * @param array<int,mixed> $items
     */
    public static function paginated(Response $response, array $items, int $total, int $page, int $perPage): Response
    {
        return self::write($response, [
            'success' => true,
            'data'    => $items,
            'message' => null,
            'errors'  => null,
            'meta'    => [
                'total'       => $total,
                'page'        => $page,
                'per_page'    => $perPage,
                'total_pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            ],
        ], 200);
    }

    /** @param array<string,mixed> $payload */
    private static function write(Response $response, array $payload, int $status): Response
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response->getBody()->write($json !== false ? $json : '{"success":false,"message":"Error al serializar la respuesta."}');

        return $response
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withStatus($status);
    }
}
