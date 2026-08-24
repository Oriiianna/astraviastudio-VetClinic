<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use DomainException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PDO;
use UnexpectedValueException;

/**
 * Emision y verificacion de tokens.
 *
 * Modelo de dos tokens:
 *
 *  - ACCESS TOKEN  (JWT, 15 min, stateless). Viaja en `Authorization: Bearer`.
 *    Como es corto, no hace falta consultar la base en cada request.
 *
 *  - REFRESH TOKEN (opaco, 7 dias, con estado en BD). Viaja en una cookie
 *    httpOnly, por lo que ningun JavaScript -ni uno inyectado via XSS- puede
 *    leerlo. En la tabla se guarda solo su SHA-256: si alguien lee la tabla,
 *    no obtiene tokens usables.
 *
 * En el refresh se aplica rotacion: el token usado se revoca y se emite uno
 * nuevo. Asi, si un token robado se usa, el legitimo deja de funcionar y el
 * incidente se vuelve visible en lugar de silencioso.
 */
final class TokenService
{
    private PDO $db;
    /** @var array<string,mixed> */
    private array $jwt;

    /** @param array<string,mixed> $jwtConfig */
    public function __construct(PDO $db, array $jwtConfig)
    {
        $this->db  = $db;
        $this->jwt = $jwtConfig;
    }

    /** @param array<string,mixed> $usuario */
    public function crearAccessToken(array $usuario): string
    {
        $ahora = time();

        return JWT::encode([
            'iss'  => $this->jwt['issuer'],
            'iat'  => $ahora,
            'nbf'  => $ahora,
            'exp'  => $ahora + $this->jwt['access_ttl'],
            'jti'  => bin2hex(random_bytes(8)),
            'sub'  => (int) $usuario['id'],
            'rol'  => $usuario['rol'],
            'name' => $usuario['nombre'] . ' ' . $usuario['apellido'],
        ], $this->jwt['secret'], $this->jwt['algoritmo']);
    }

    /**
     * @return array<string,mixed> Claims del token.
     * @throws ApiException si el token esta vencido, alterado o mal formado.
     */
    public function verificarAccessToken(string $token): array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->jwt['secret'], $this->jwt['algoritmo']));

            return (array) $decoded;
        } catch (ExpiredException $e) {
            throw ApiException::unauthorized('La sesion expiro. Volve a iniciar sesion.');
        } catch (UnexpectedValueException | DomainException $e) {
            // Firma invalida, algoritmo distinto al esperado o JSON corrupto.
            throw ApiException::unauthorized('Token invalido.');
        }
    }

    /**
     * Genera un refresh token y lo persiste hasheado.
     *
     * @return string El token en claro. Es la unica vez que existe: en BD solo
     *                queda el hash.
     */
    public function emitirRefreshToken(int $usuarioId, ?string $userAgent, ?string $ip): string
    {
        $token = bin2hex(random_bytes(32));

        $stmt = $this->db->prepare(
            'INSERT INTO refresh_tokens (usuario_id, token_hash, user_agent, ip, expires_at)
             VALUES (:usuario_id, :hash, :ua, :ip, :expira)'
        );

        $stmt->execute([
            'usuario_id' => $usuarioId,
            'hash'       => hash('sha256', $token),
            'ua'         => $userAgent !== null ? mb_substr($userAgent, 0, 255) : null,
            'ip'         => $ip,
            'expira'     => date('Y-m-d H:i:s', time() + $this->jwt['refresh_ttl']),
        ]);

        return $token;
    }

    /**
     * Segundos durante los que un refresh token recien rotado se sigue
     * aceptando.
     *
     * Sin esta ventana, dos pestanias que recargan a la vez envian el mismo
     * token: una gana la rotacion y la otra recibe un 401 y expulsa a un
     * usuario legitimo. Es una condicion de carrera real, no teorica.
     *
     * Un reuso MAS ALLA de la ventana si es sospechoso (token filtrado), y se
     * trata como tal revocando toda la sesion del usuario.
     */
    private const GRACIA_ROTACION_SEG = 30;

    /**
     * Valida un refresh token y devuelve el usuario asociado.
     *
     * @return array<string,mixed>
     * @throws ApiException
     */
    public function usuarioDesdeRefreshToken(string $token): array
    {
        $hash = hash('sha256', $token);

        $stmt = $this->db->prepare(
            'SELECT rt.id AS token_id, rt.revoked_at, rt.expires_at,
                    u.id, u.nombre, u.apellido, u.email, u.rol, u.activo
             FROM refresh_tokens rt
             INNER JOIN usuarios u ON u.id = rt.usuario_id
             WHERE rt.token_hash = :hash
             LIMIT 1'
        );

        $stmt->execute(['hash' => $hash]);
        $fila = $stmt->fetch();

        // El token nunca existio: no hay nada que revocar ni que sospechar.
        if ($fila === false) {
            throw ApiException::unauthorized('Sesion invalida o expirada.');
        }

        if (strtotime((string) $fila['expires_at']) < time()) {
            throw ApiException::unauthorized('La sesion expiro. Volve a iniciar sesion.');
        }

        if ($fila['revoked_at'] !== null) {
            $segundosDesdeRevocacion = time() - strtotime((string) $fila['revoked_at']);

            if ($segundosDesdeRevocacion > self::GRACIA_ROTACION_SEG) {
                // Reuso tardio de un token ya rotado: la hipotesis mas probable
                // es que se filtro. Se cierran TODAS las sesiones del usuario
                // para expulsar a quien lo tenga.
                $this->revocarTodosDelUsuario((int) $fila['id']);

                throw ApiException::unauthorized(
                    'Se detecto un uso indebido de la sesion. Volve a iniciar sesion.'
                );
            }
            // Dentro de la ventana: es la carrera entre pestanias, se permite.
        }

        if ((int) $fila['activo'] !== 1) {
            throw ApiException::forbidden('El usuario esta deshabilitado.');
        }

        return $fila;
    }

    public function revocarRefreshToken(string $token): void
    {
        $stmt = $this->db->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW()
             WHERE token_hash = :hash AND revoked_at IS NULL'
        );

        $stmt->execute(['hash' => hash('sha256', $token)]);
    }

    /** Cierra todas las sesiones del usuario (cambio de password, robo, etc). */
    public function revocarTodosDelUsuario(int $usuarioId): void
    {
        $stmt = $this->db->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW()
             WHERE usuario_id = :id AND revoked_at IS NULL'
        );

        $stmt->execute(['id' => $usuarioId]);
    }
}
