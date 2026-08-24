<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * Error de negocio con un codigo HTTP asociado y un mensaje que SI es seguro
 * mostrarle al usuario final. Cualquier otra excepcion se convierte en un 500
 * generico sin detalles.
 */
class ApiException extends RuntimeException
{
    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message, $status);
    }

    public static function notFound(string $recurso = 'El recurso'): self
    {
        return new self("$recurso no fue encontrado.", 404);
    }

    public static function unauthorized(string $message = 'Credenciales invalidas o sesion expirada.'): self
    {
        return new self($message, 401);
    }

    public static function forbidden(string $message = 'No tenes permisos para realizar esta accion.'): self
    {
        return new self($message, 403);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }

    public static function tooManyRequests(string $message): self
    {
        return new self($message, 429);
    }
}
