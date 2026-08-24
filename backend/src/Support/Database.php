<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Fabrica de conexiones PDO.
 *
 * Los tres flags de abajo no son opcionales:
 *
 *  - ERRMODE_EXCEPTION   : sin esto los errores de SQL pasan en silencio.
 *  - EMULATE_PREPARES=false : fuerza sentencias preparadas REALES del lado del
 *    servidor. Con la emulacion activada (default de PHP) el driver interpola
 *    los parametros escapando a mano, lo que ha tenido bypasses historicos con
 *    ciertos charsets. Este es el flag que de verdad cierra la puerta a la
 *    inyeccion SQL.
 *  - FETCH_ASSOC         : evita el array duplicado indice/nombre.
 */
final class Database
{
    private static ?PDO $instance = null;

    /** @param array<string,mixed> $config */
    public static function connect(array $config): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['name'],
            $config['charset']
        );

        try {
            self::$instance = new PDO($dsn, $config['user'], $config['pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ]);
        } catch (PDOException $e) {
            // El mensaje original puede contener usuario y host: no debe salir
            // nunca hacia el cliente. Se registra arriba, en el error handler.
            throw new RuntimeException('No se pudo conectar a la base de datos.', 0, $e);
        }

        return self::$instance;
    }
}
