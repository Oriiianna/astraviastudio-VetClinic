<?php

declare(strict_types=1);

/**
 * Traduce el .env a un array de settings tipado.
 *
 * Este es el UNICO lugar del proyecto que lee variables de entorno: nada
 * dentro de src/ toca $_ENV, asi el dominio queda testeable sin entorno.
 */

use Dotenv\Dotenv;

$raiz = dirname(__DIR__);

// createImmutable no pisa variables ya definidas en el entorno real del
// servidor, que es lo que se quiere en produccion.
$dotenv = Dotenv::createImmutable($raiz);
$dotenv->safeLoad();

$dotenv->required(['DB_NAME', 'DB_USER', 'JWT_SECRET']);

/** Lee una variable con valor por defecto y castea "true"/"false". */
$env = static function (string $clave, $defecto = null) {
    $valor = $_ENV[$clave] ?? getenv($clave);

    if ($valor === false || $valor === null || $valor === '') {
        return $defecto;
    }

    return match (strtolower((string) $valor)) {
        'true', '(true)'   => true,
        'false', '(false)' => false,
        'null', '(null)'   => null,
        default            => $valor,
    };
};

$jwtSecret = (string) $env('JWT_SECRET', '');

if (strlen($jwtSecret) < 32) {
    throw new RuntimeException(
        'JWT_SECRET debe tener al menos 32 caracteres. ' .
        'Generar con: php -r "echo bin2hex(random_bytes(32));"'
    );
}

$entorno = (string) $env('APP_ENV', 'production');

return [
    'env'          => $entorno,
    'debug'        => $entorno === 'development',
    'name'         => (string) $env('APP_NAME', 'Veterinaria API'),
    'raiz'         => $raiz,
    // Adjuntos clinicos: fuera de public/, se entregan por un endpoint
    // autenticado (ver App\Support\Almacenamiento y AdjuntoController).
    'storage_dir'  => $raiz . '/storage/adjuntos',
    'uploads_dir'  => $raiz . '/public/uploads',

    'db' => [
        'host'    => (string) $env('DB_HOST', '127.0.0.1'),
        'port'    => (int) $env('DB_PORT', 3306),
        'name'    => (string) $env('DB_NAME'),
        'user'    => (string) $env('DB_USER'),
        'pass'    => (string) $env('DB_PASS', ''),
        'charset' => (string) $env('DB_CHARSET', 'utf8mb4'),
    ],

    'jwt' => [
        'secret'      => $jwtSecret,
        'algoritmo'   => 'HS256',
        'issuer'      => (string) $env('JWT_ISSUER', 'veterinaria-api'),
        'access_ttl'  => (int) $env('JWT_ACCESS_TTL', 900),
        'refresh_ttl' => (int) $env('JWT_REFRESH_TTL', 604800),
    ],

    'cors' => [
        // Whitelist explicita. No se usa "*" porque la API responde con
        // credenciales (cookie del refresh token) y el navegador rechaza
        // el comodin en ese caso.
        'origenes' => array_values(array_filter(
            array_map('trim', explode(',', (string) $env('CORS_ALLOWED_ORIGINS', '')))
        )),
        'max_age'  => 86400,
    ],

    'cookie' => [
        'secure'   => (bool) $env('COOKIE_SECURE', true),
        'domain'   => (string) $env('COOKIE_DOMAIN', ''),
        'path'     => '/api/auth',
        'samesite' => 'Strict',
    ],

    'login' => [
        'max_intentos' => (int) $env('LOGIN_MAX_ATTEMPTS', 5),
        'bloqueo_seg'  => (int) $env('LOGIN_LOCKOUT_SECONDS', 900),
    ],

    'logs' => [
        'ruta'  => $raiz . '/logs/app.log',
        'nivel' => $entorno === 'development' ? 'debug' : 'warning',
    ],
];
