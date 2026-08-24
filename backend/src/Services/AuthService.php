<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Usuario;
use PDO;

/**
 * Login, refresh y logout.
 *
 * Decisiones de seguridad aplicadas aqui:
 *
 *  - Mensaje de error unico ante usuario inexistente o password incorrecta.
 *    Distinguirlos permitiria enumerar que emails existen en el sistema.
 *  - Bloqueo temporal por combinacion email+IP tras N intentos fallidos.
 *  - password_verify() con rehash automatico: si en el futuro sube el coste
 *    del algoritmo, las contrasenas se migran solas al iniciar sesion.
 */
final class AuthService
{
    private PDO $db;
    private Usuario $usuarios;
    private TokenService $tokens;
    /** @var array<string,mixed> */
    private array $configLogin;

    /** @param array<string,mixed> $configLogin */
    public function __construct(PDO $db, Usuario $usuarios, TokenService $tokens, array $configLogin)
    {
        $this->db          = $db;
        $this->usuarios    = $usuarios;
        $this->tokens      = $tokens;
        $this->configLogin = $configLogin;
    }

    /**
     * @return array{usuario: array<string,mixed>, access_token: string, refresh_token: string, expires_in: int}
     * @throws ApiException
     */
    public function login(string $email, string $password, ?string $userAgent, string $ip): array
    {
        $email = strtolower(trim($email));

        $this->verificarBloqueo($email, $ip);

        $usuario = $this->usuarios->buscarPorEmailParaLogin($email);

        // Si el usuario no existe se ejecuta igual un password_verify contra un
        // hash ficticio. Sin esto, el tiempo de respuesta delata que emails
        // estan registrados (timing attack).
        $hash = $usuario['password_hash']
            ?? '$2y$10$usuarioInexistenteXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

        $passwordOk = password_verify($password, $hash);

        if ($usuario === null || !$passwordOk) {
            $this->registrarIntento($email, $ip, false);

            throw ApiException::unauthorized('Email o contrasena incorrectos.');
        }

        if ((int) $usuario['activo'] !== 1) {
            $this->registrarIntento($email, $ip, false);

            throw ApiException::forbidden('Tu cuenta esta deshabilitada. Contactate con un administrador.');
        }

        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            $this->usuarios->actualizarPassword((int) $usuario['id'], $password);
        }

        $this->registrarIntento($email, $ip, true);
        $this->usuarios->registrarAcceso((int) $usuario['id']);

        return [
            'usuario'       => $this->usuarios->perfil((int) $usuario['id']),
            'access_token'  => $this->tokens->crearAccessToken($usuario),
            'refresh_token' => $this->tokens->emitirRefreshToken((int) $usuario['id'], $userAgent, $ip),
            'expires_in'    => 0, // lo completa el controlador con el TTL configurado
        ];
    }

    /**
     * Rotacion de refresh token: se revoca el anterior y se emite uno nuevo.
     *
     * @return array{usuario: array<string,mixed>, access_token: string, refresh_token: string}
     */
    public function refrescar(string $refreshToken, ?string $userAgent, string $ip): array
    {
        $usuario = $this->tokens->usuarioDesdeRefreshToken($refreshToken);

        $this->db->beginTransaction();

        try {
            // Idempotente: si el token ya estaba revocado (carrera entre
            // pestanias dentro de la ventana de gracia) no se toca su
            // revoked_at, para que la gracia siga contando desde el uso
            // original y no se extienda indefinidamente.
            $this->tokens->revocarRefreshToken($refreshToken);
            $nuevoRefresh = $this->tokens->emitirRefreshToken((int) $usuario['id'], $userAgent, $ip);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();

            throw $e;
        }

        return [
            'usuario'       => $this->usuarios->perfil((int) $usuario['id']),
            'access_token'  => $this->tokens->crearAccessToken($usuario),
            'refresh_token' => $nuevoRefresh,
        ];
    }

    public function logout(?string $refreshToken): void
    {
        if ($refreshToken !== null && $refreshToken !== '') {
            $this->tokens->revocarRefreshToken($refreshToken);
        }
    }

    /**
     * Cambio de password propio. Revoca todas las sesiones abiertas: si la
     * cuenta estaba comprometida, cambiar la clave debe expulsar al intruso.
     */
    public function cambiarPassword(int $usuarioId, string $actual, string $nueva): void
    {
        $perfil  = $this->usuarios->perfil($usuarioId);

        if ($perfil === null) {
            throw ApiException::notFound('El usuario');
        }

        $usuario = $this->usuarios->buscarPorEmailParaLogin($perfil['email']);

        if ($usuario === null || !password_verify($actual, $usuario['password_hash'])) {
            throw ApiException::unauthorized('La contrasena actual no es correcta.');
        }

        $this->usuarios->actualizarPassword($usuarioId, $nueva);
        $this->tokens->revocarTodosDelUsuario($usuarioId);
    }

    /** @throws ApiException si la combinacion email+IP esta bloqueada. */
    private function verificarBloqueo(string $email, string $ip): void
    {
        // La ventana se interpola casteada a int: no viene del usuario sino de
        // config, y MySQL no acepta parametros ligados dentro de INTERVAL de
        // forma portable. El casteo elimina cualquier contenido no numerico.
        $ventana = (int) $this->configLogin['bloqueo_seg'];

        $stmt = $this->db->prepare(
            "SELECT COUNT(*) FROM intentos_login
             WHERE email = :email AND ip = :ip AND exitoso = 0
               AND created_at > (NOW() - INTERVAL $ventana SECOND)"
        );

        $stmt->execute(['email' => $email, 'ip' => $ip]);

        if ((int) $stmt->fetchColumn() >= (int) $this->configLogin['max_intentos']) {
            $minutos = (int) ceil($this->configLogin['bloqueo_seg'] / 60);

            throw ApiException::tooManyRequests(
                "Demasiados intentos fallidos. Volve a intentar en $minutos minutos."
            );
        }
    }

    private function registrarIntento(string $email, string $ip, bool $exitoso): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO intentos_login (email, ip, exitoso) VALUES (:email, :ip, :exitoso)'
        );
        $stmt->execute(['email' => $email, 'ip' => $ip, 'exitoso' => $exitoso ? 1 : 0]);

        // Un login correcto limpia el contador: el usuario legitimo que se
        // equivoco cuatro veces no arrastra el bloqueo a la sesion siguiente.
        if ($exitoso) {
            $limpiar = $this->db->prepare(
                'DELETE FROM intentos_login WHERE email = :email AND ip = :ip AND exitoso = 0'
            );
            $limpiar->execute(['email' => $email, 'ip' => $ip]);
        }
    }
}
