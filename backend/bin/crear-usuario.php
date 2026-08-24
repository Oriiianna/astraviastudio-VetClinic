<?php

/**
 * Alta de usuarios del sistema desde la consola.
 *
 *   php bin/crear-usuario.php
 *
 * Existe para que ningun hash de password quede escrito en un archivo .sql
 * versionado. El hash se genera aqui, en el momento, con password_hash().
 */

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\Database;

if (PHP_SAPI !== 'cli') {
    exit("Este script solo se ejecuta por linea de comandos.\n");
}

$settings = require __DIR__ . '/../config/settings.php';

/** Lee un valor por stdin, opcionalmente ocultando lo tecleado. */
function preguntar(string $etiqueta, bool $oculto = false): string
{
    echo $etiqueta;

    if ($oculto && DIRECTORY_SEPARATOR !== '\\') {
        shell_exec('stty -echo');
        $valor = trim((string) fgets(STDIN));
        shell_exec('stty echo');
        echo PHP_EOL;

        return $valor;
    }

    // En Windows no hay stty: se advierte que el texto sera visible.
    return trim((string) fgets(STDIN));
}

$roles = ['admin', 'veterinario', 'recepcionista'];

echo "\n=== Alta de usuario ===\n\n";

$nombre   = preguntar('Nombre           : ');
$apellido = preguntar('Apellido         : ');
$email    = strtolower(preguntar('Email            : '));

echo 'Rol (' . implode(' / ', $roles) . '): ';
$rol = trim((string) fgets(STDIN));

if (!in_array($rol, $roles, true)) {
    exit("\nError: rol invalido.\n");
}

$matricula = '';
if ($rol === 'veterinario') {
    $matricula = preguntar('Matricula        : ');
}

if (DIRECTORY_SEPARATOR === '\\') {
    echo "\n(Windows: la contrasena sera visible al teclearla)\n";
}
$password = preguntar('Password         : ', true);
$confirma = preguntar('Repetir password : ', true);

if ($password !== $confirma) {
    exit("\nError: las contrasenas no coinciden.\n");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    exit("\nError: email invalido.\n");
}

if (strlen($password) < 8) {
    exit("\nError: la contrasena debe tener al menos 8 caracteres.\n");
}

try {
    $pdo = Database::connect($settings['db']);

    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, matricula)
         VALUES (:nombre, :apellido, :email, :hash, :rol, :matricula)'
    );

    $stmt->execute([
        'nombre'    => $nombre,
        'apellido'  => $apellido,
        'email'     => $email,
        'hash'      => password_hash($password, PASSWORD_DEFAULT),
        'rol'       => $rol,
        'matricula' => $matricula !== '' ? $matricula : null,
    ]);

    printf("\nUsuario creado (id %d): %s <%s> [%s]\n", (int) $pdo->lastInsertId(), "$nombre $apellido", $email, $rol);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        exit("\nError: ya existe un usuario con ese email.\n");
    }
    exit("\nError de base de datos: {$e->getMessage()}\n");
}
