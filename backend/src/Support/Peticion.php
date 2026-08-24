<?php

declare(strict_types=1);

namespace App\Support;

use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Utilidades de lectura de la request que se repiten en todos los
 * controladores.
 */
final class Peticion
{
    /** @return array<string,mixed> Body JSON o form, siempre como array. */
    public static function body(Request $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? $body : [];
    }

    /** @return array<string,mixed> */
    public static function query(Request $request): array
    {
        return $request->getQueryParams();
    }

    public static function queryString(Request $request, string $clave, ?string $defecto = null): ?string
    {
        $valor = $request->getQueryParams()[$clave] ?? null;

        if ($valor === null || !is_scalar($valor)) {
            return $defecto;
        }

        $valor = trim((string) $valor);

        return $valor === '' ? $defecto : $valor;
    }

    public static function queryInt(Request $request, string $clave, int $defecto): int
    {
        $valor = $request->getQueryParams()[$clave] ?? null;

        return is_numeric($valor) ? (int) $valor : $defecto;
    }

    /**
     * IP del cliente. Detras de un proxy o balanceador se debe confiar en
     * X-Forwarded-For SOLO si ese proxy es propio; de lo contrario cualquiera
     * puede falsear la cabecera y esquivar el rate limiting. Por eso el
     * comportamiento por defecto es usar REMOTE_ADDR.
     */
    public static function ip(Request $request, bool $confiarEnProxy = false): string
    {
        $server = $request->getServerParams();

        if ($confiarEnProxy) {
            $forwarded = $request->getHeaderLine('X-Forwarded-For');

            if ($forwarded !== '') {
                $primera = trim(explode(',', $forwarded)[0]);

                if (filter_var($primera, FILTER_VALIDATE_IP) !== false) {
                    return $primera;
                }
            }
        }

        return (string) ($server['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public static function userAgent(Request $request): ?string
    {
        $ua = $request->getHeaderLine('User-Agent');

        return $ua === '' ? null : $ua;
    }
}
