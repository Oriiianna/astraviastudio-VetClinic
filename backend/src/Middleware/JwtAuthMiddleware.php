<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Exceptions\ApiException;
use App\Services\TokenService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Exige un access token valido y deja los datos del usuario como atributos
 * de la request, para que los controladores no vuelvan a decodificar el JWT.
 *
 * Atributos disponibles aguas abajo:
 *   usuario_id (int), usuario_rol (string), usuario_nombre (string)
 */
final class JwtAuthMiddleware implements MiddlewareInterface
{
    private TokenService $tokens;

    public function __construct(TokenService $tokens)
    {
        $this->tokens = $tokens;
    }

    public function process(Request $request, Handler $handler): Response
    {
        $token = $this->extraerToken($request);

        if ($token === null) {
            throw ApiException::unauthorized('Falta el token de autenticacion.');
        }

        $claims = $this->tokens->verificarAccessToken($token);

        $request = $request
            ->withAttribute('usuario_id', (int) ($claims['sub'] ?? 0))
            ->withAttribute('usuario_rol', (string) ($claims['rol'] ?? ''))
            ->withAttribute('usuario_nombre', (string) ($claims['name'] ?? ''));

        return $handler->handle($request);
    }

    private function extraerToken(Request $request): ?string
    {
        $header = $request->getHeaderLine('Authorization');

        // Apache en modo CGI/FastCGI no siempre propaga Authorization; el
        // .htaccess lo reinyecta como REDIRECT_HTTP_AUTHORIZATION.
        if ($header === '') {
            $server = $request->getServerParams();
            $header = $server['HTTP_AUTHORIZATION']
                ?? $server['REDIRECT_HTTP_AUTHORIZATION']
                ?? '';
        }

        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m) === 1) {
            return $m[1];
        }

        return null;
    }
}
