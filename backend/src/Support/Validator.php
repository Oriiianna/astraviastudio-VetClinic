<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\ValidationException;

/**
 * Validador minimo, sin dependencias externas.
 *
 * Uso:
 *   $datos = (new Validator($body))
 *       ->required('nombre')->maxLen('nombre', 80)
 *       ->required('email')->email('email')
 *       ->validate();          // lanza ValidationException si algo falla
 *
 * validate() devuelve SOLO las claves que fueron declaradas con alguna regla.
 * Es la parte importante: actua como whitelist, de modo que un cliente no
 * puede inyectar campos extra (por ejemplo "rol") en un update masivo.
 */
final class Validator
{
    /** @var array<string,mixed> */
    private array $input;

    /** @var array<string,string> */
    private array $errors = [];

    /** @var array<string,bool> */
    private array $touched = [];

    /** @param array<string,mixed> $input */
    public function __construct(array $input)
    {
        $this->input = $input;
    }

    public function required(string $campo, ?string $etiqueta = null): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if ($valor === null || $valor === '' || (is_array($valor) && $valor === [])) {
            $this->addError($campo, sprintf('%s es obligatorio.', $etiqueta ?? $this->label($campo)));
        }

        return $this;
    }

    /** Marca el campo como aceptado sin exigir que venga. */
    public function optional(string $campo): self
    {
        $this->touched[$campo] = true;

        return $this;
    }

    public function email(string $campo): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if ($this->present($valor) && !filter_var((string) $valor, FILTER_VALIDATE_EMAIL)) {
            $this->addError($campo, 'El email no tiene un formato valido.');
        }

        return $this;
    }

    public function minLen(string $campo, int $min): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if ($this->present($valor) && mb_strlen((string) $valor) < $min) {
            $this->addError($campo, sprintf('%s debe tener al menos %d caracteres.', $this->label($campo), $min));
        }

        return $this;
    }

    public function maxLen(string $campo, int $max): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if ($this->present($valor) && mb_strlen((string) $valor) > $max) {
            $this->addError($campo, sprintf('%s no puede superar los %d caracteres.', $this->label($campo), $max));
        }

        return $this;
    }

    /** @param array<int,string> $permitidos */
    public function in(string $campo, array $permitidos): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if ($this->present($valor) && !in_array((string) $valor, $permitidos, true)) {
            $this->addError($campo, sprintf('%s debe ser uno de: %s.', $this->label($campo), implode(', ', $permitidos)));
        }

        return $this;
    }

    public function numeric(string $campo, ?float $min = null, ?float $max = null): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if (!$this->present($valor)) {
            return $this;
        }

        if (!is_numeric($valor)) {
            $this->addError($campo, sprintf('%s debe ser un numero.', $this->label($campo)));

            return $this;
        }

        $num = (float) $valor;

        if ($min !== null && $num < $min) {
            $this->addError($campo, sprintf('%s no puede ser menor a %s.', $this->label($campo), $min));
        }

        if ($max !== null && $num > $max) {
            $this->addError($campo, sprintf('%s no puede ser mayor a %s.', $this->label($campo), $max));
        }

        return $this;
    }

    public function date(string $campo, string $formato = 'Y-m-d'): self
    {
        $this->touched[$campo] = true;
        $valor = $this->value($campo);

        if (!$this->present($valor)) {
            return $this;
        }

        $fecha = \DateTimeImmutable::createFromFormat($formato, (string) $valor);

        if ($fecha === false || $fecha->format($formato) !== (string) $valor) {
            $this->addError($campo, sprintf('%s no es una fecha valida (%s).', $this->label($campo), $formato));
        }

        return $this;
    }

    /**
     * @return array<string,mixed> Solo las claves declaradas, con los strings
     *                             recortados y los vacios normalizados a null.
     * @throws ValidationException
     */
    public function validate(): array
    {
        if ($this->errors !== []) {
            throw new ValidationException($this->errors);
        }

        $limpio = [];

        foreach (array_keys($this->touched) as $campo) {
            if (!array_key_exists($campo, $this->input)) {
                continue;
            }

            $valor = $this->input[$campo];

            if (is_string($valor)) {
                $valor = trim($valor);
                $valor = $valor === '' ? null : $valor;
            }

            $limpio[$campo] = $valor;
        }

        return $limpio;
    }

    /** @return mixed */
    private function value(string $campo)
    {
        return $this->input[$campo] ?? null;
    }

    /** @param mixed $valor */
    private function present($valor): bool
    {
        return $valor !== null && $valor !== '';
    }

    private function label(string $campo): string
    {
        return ucfirst(str_replace('_', ' ', $campo));
    }

    private function addError(string $campo, string $mensaje): void
    {
        // Solo el primer error por campo: mostrar cinco mensajes sobre el mismo
        // input es ruido para quien completa el formulario.
        $this->errors[$campo] ??= $mensaje;
    }
}
