<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Autorizacion por rol. Se encadena SIEMPRE despues de JwtAuthMiddleware,
 * del que consume el atributo `usuario_rol`.
 *
 *   $app->get('/usuarios', ...)->add(new RoleMiddleware(['admin']));
 *
 * El rol `admin` no se incluye implicitamente: si una ruta debe permitir al
 * administrador, hay que listarlo. Los permisos implicitos son la forma
 * habitual de abrir un agujero sin darse cuenta.
 */
final class RoleMiddleware implements MiddlewareInterface
{
    /** @var array<int,string> */
    private array $rolesPermitidos;

    /** @param array<int,string> $rolesPermitidos */
    public function __construct(array $rolesPermitidos)
    {
        $this->rolesPermitidos = $rolesPermitidos;
    }

    public function process(Request $request, Handler $handler): Response
    {
        $rol = (string) $request->getAttribute('usuario_rol', '');

        if ($rol === '') {
            throw ApiException::unauthorized();
        }

        if (!in_array($rol, $this->rolesPermitidos, true)) {
            throw ApiException::forbidden(
                'Tu rol (' . $rol . ') no tiene acceso a este recurso.'
            );
        }

        return $handler->handle($request);
    }
}
