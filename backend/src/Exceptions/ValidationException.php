<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * Datos de entrada invalidos. Se traduce a un 422 con el detalle campo a campo.
 */
final class ValidationException extends RuntimeException
{
    /** @var array<string,string> */
    private array $errors;

    /** @param array<string,string> $errors */
    public function __construct(array $errors, string $message = 'Los datos enviados no son validos.')
    {
        parent::__construct($message, 422);
        $this->errors = $errors;
    }

    /** @return array<string,string> */
    public function getErrors(): array
    {
        return $this->errors;
    }
}
