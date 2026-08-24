<?php

declare(strict_types=1);

namespace App\Middleware;

use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * CORS con whitelist de origenes.
 *
 * Dos detalles que suelen costar horas de depuracion:
 *
 * 1. El preflight (OPTIONS) se responde ACA y no se delega al handler. Si se
 *    dejara pasar, Slim devolveria 405 sobre rutas que solo aceptan POST y el
 *    navegador cancelaria la peticion real antes de enviarla.
 *
 * 2. Se refleja el Origin concreto, nunca "*". Con Allow-Credentials: true el
 *    navegador rechaza el comodin, y esta API manda la cookie del refresh
 *    token. Ademas se agrega `Vary: Origin` para que ningun proxy cachee la
 *    respuesta de un origen y se la sirva a otro.
 *
 * Registrar este middleware el ULTIMO en la pila (config/middleware.php) para
 * que se ejecute el PRIMERO y las respuestas de error tambien lleven cabeceras.
 */
final class CorsMiddleware implements MiddlewareInterface
{
    /** @var array<int,string> */
    private array $origenesPermitidos;
    private int $maxAge;
    private ResponseFactoryInterface $responseFactory;

    /** @param array<string,mixed> $config */
    public function __construct(array $config, ResponseFactoryInterface $responseFactory)
    {
        $this->origenesPermitidos = $config['origenes'] ?? [];
        $this->maxAge             = (int) ($config['max_age'] ?? 86400);
        $this->responseFactory    = $responseFactory;
    }

    public function process(Request $request, Handler $handler): Response
    {
        $origen = $request->getHeaderLine('Origin');

        $response = $request->getMethod() === 'OPTIONS'
            ? $this->responseFactory->createResponse(204)
            : $handler->handle($request);

        if ($origen === '' || !in_array($origen, $this->origenesPermitidos, true)) {
            // Origen desconocido: se responde sin cabeceras CORS y es el
            // navegador el que bloquea. No se devuelve un error: eso filtraria
            // informacion sobre que origenes estan configurados.
            return $response->withHeader('Vary', 'Origin');
        }

        return $response
            ->withHeader('Access-Control-Allow-Origin', $origen)
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition')
            ->withHeader('Access-Control-Max-Age', (string) $this->maxAge)
            ->withHeader('Vary', 'Origin');
    }
}
