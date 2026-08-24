<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Usuario;
use App\Services\AuthService;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Endpoints de autenticacion.
 *
 * El access token viaja en el cuerpo de la respuesta (React lo guarda en
 * memoria) y el refresh token en una cookie httpOnly que el JavaScript de la
 * pagina no puede leer. Es la combinacion que limita el dano de un XSS: si
 * inyectan un script, se llevan como mucho un token de 15 minutos, no la
 * sesion completa.
 */
final class AuthController
{
    private const COOKIE_REFRESH = 'vet_refresh';

    private AuthService $auth;
    private Usuario $usuarios;
    /** @var array<string,mixed> */
    private array $settings;

    /** @param array<string,mixed> $settings */
    public function __construct(AuthService $auth, Usuario $usuarios, array $settings)
    {
        $this->auth     = $auth;
        $this->usuarios = $usuarios;
        $this->settings = $settings;
    }

    public function login(Request $request, Response $response): Response
    {
        $datos = (new Validator(Peticion::body($request)))
            ->required('email')->email('email')->maxLen('email', 150)
            ->required('password')->maxLen('password', 200)
            ->validate();

        $resultado = $this->auth->login(
            (string) $datos['email'],
            (string) $datos['password'],
            Peticion::userAgent($request),
            Peticion::ip($request)
        );

        $response = $this->ponerCookieRefresh($response, $resultado['refresh_token']);

        return ApiResponse::success($response, [
            'usuario'      => $resultado['usuario'],
            'access_token' => $resultado['access_token'],
            'token_type'   => 'Bearer',
            'expires_in'   => $this->settings['jwt']['access_ttl'],
        ], 'Sesion iniciada.');
    }

    /**
     * Renueva el access token a partir de la cookie de refresh.
     * El frontend lo llama de forma transparente al recibir un 401.
     */
    public function refresh(Request $request, Response $response): Response
    {
        $refreshToken = $this->leerCookieRefresh($request);

        if ($refreshToken === null) {
            return ApiResponse::error($response, 'No hay una sesion activa.', 401);
        }

        $resultado = $this->auth->refrescar(
            $refreshToken,
            Peticion::userAgent($request),
            Peticion::ip($request)
        );

        $response = $this->ponerCookieRefresh($response, $resultado['refresh_token']);

        return ApiResponse::success($response, [
            'usuario'      => $resultado['usuario'],
            'access_token' => $resultado['access_token'],
            'token_type'   => 'Bearer',
            'expires_in'   => $this->settings['jwt']['access_ttl'],
        ]);
    }

    public function logout(Request $request, Response $response): Response
    {
        $this->auth->logout($this->leerCookieRefresh($request));

        return ApiResponse::success(
            $this->borrarCookieRefresh($response),
            null,
            'Sesion cerrada.'
        );
    }

    /** Perfil del usuario autenticado. */
    public function me(Request $request, Response $response): Response
    {
        $perfil = $this->usuarios->perfil((int) $request->getAttribute('usuario_id'));

        if ($perfil === null) {
            return ApiResponse::error($response, 'Usuario no encontrado.', 404);
        }

        return ApiResponse::success($response, $perfil);
    }

    public function cambiarPassword(Request $request, Response $response): Response
    {
        $datos = (new Validator(Peticion::body($request)))
            ->required('password_actual')
            ->required('password_nueva')->minLen('password_nueva', 8)->maxLen('password_nueva', 200)
            ->validate();

        $this->auth->cambiarPassword(
            (int) $request->getAttribute('usuario_id'),
            (string) $datos['password_actual'],
            (string) $datos['password_nueva']
        );

        return ApiResponse::success(
            $this->borrarCookieRefresh($response),
            null,
            'Contrasena actualizada. Volve a iniciar sesion.'
        );
    }

    // ------------------------------------------------------------------ //

    private function ponerCookieRefresh(Response $response, string $token): Response
    {
        return $response->withAddedHeader(
            'Set-Cookie',
            $this->construirCookie($token, $this->settings['jwt']['refresh_ttl'])
        );
    }

    private function borrarCookieRefresh(Response $response): Response
    {
        return $response->withAddedHeader('Set-Cookie', $this->construirCookie('', -3600));
    }

    private function construirCookie(string $valor, int $ttl): string
    {
        $cfg = $this->settings['cookie'];

        $partes = [
            self::COOKIE_REFRESH . '=' . urlencode($valor),
            'Expires=' . gmdate('D, d M Y H:i:s T', time() + $ttl),
            'Max-Age=' . $ttl,
            // Path acotado: la cookie solo se envia a los endpoints de auth,
            // no en cada peticion de datos.
            'Path=' . $cfg['path'],
            'HttpOnly',
            'SameSite=' . $cfg['samesite'],
        ];

        if ($cfg['domain'] !== '') {
            $partes[] = 'Domain=' . $cfg['domain'];
        }

        // Secure exige HTTPS. En desarrollo sobre http://localhost se apaga
        // via COOKIE_SECURE=false, o el navegador descarta la cookie.
        if ($cfg['secure']) {
            $partes[] = 'Secure';
        }

        return implode('; ', $partes);
    }

    private function leerCookieRefresh(Request $request): ?string
    {
        $token = $request->getCookieParams()[self::COOKIE_REFRESH] ?? null;

        if (is_string($token) && $token !== '') {
            return $token;
        }

        // Alternativa para clientes que no manejan cookies (apps moviles,
        // pruebas con curl): aceptar el token en el cuerpo.
        $body = Peticion::body($request);

        return isset($body['refresh_token']) && is_string($body['refresh_token']) && $body['refresh_token'] !== ''
            ? $body['refresh_token']
            : null;
    }
}
