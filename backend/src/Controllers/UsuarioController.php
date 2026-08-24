<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Models\Usuario;
use App\Services\TokenService;
use App\Support\ApiResponse;
use App\Support\Peticion;
use App\Support\Validator;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Perfil propio y administracion de usuarios.
 *
 * Separacion deliberada:
 *
 *  - `perfil()` deja que CUALQUIER usuario edite sus datos de contacto. El id
 *    sale del token, nunca de la URL ni del body, asi que no hay forma de
 *    editar el perfil de otro por este camino.
 *  - El resto del controlador es solo para admin y si permite tocar rol y
 *    estado, que son las dos cosas que un usuario jamas debe cambiarse a si
 *    mismo.
 */
final class UsuarioController
{
    private const ROLES = ['admin', 'veterinario', 'recepcionista'];

    private Usuario $usuarios;
    private TokenService $tokens;

    public function __construct(Usuario $usuarios, TokenService $tokens)
    {
        $this->usuarios = $usuarios;
        $this->tokens   = $tokens;
    }

    // ============================ perfil propio ============================ //

    /**
     * PUT /api/auth/perfil
     *
     * Nombre, apellido, email, telefono y matricula del usuario autenticado.
     * `rol` y `activo` no estan en la whitelist del modelo, asi que aunque
     * lleguen en el body no se escriben.
     */
    public function actualizarPerfil(Request $request, Response $response): Response
    {
        $id  = (int) $request->getAttribute('usuario_id');
        $rol = (string) $request->getAttribute('usuario_rol');

        $perfil = $this->usuarios->perfil($id);

        if ($perfil === null) {
            throw ApiException::notFound('El usuario');
        }

        $datos = $this->validarDatos(Peticion::body($request), $rol, $id);

        $this->usuarios->actualizar($id, $datos);

        return ApiResponse::success(
            $response,
            $this->usuarios->perfil($id),
            'Datos actualizados.'
        );
    }

    // ========================= administracion (admin) ====================== //

    /** GET /api/usuarios?rol=&incluir_inactivos=1 */
    public function index(Request $request, Response $response): Response
    {
        $rol = Peticion::queryString($request, 'rol');

        if ($rol !== null && !in_array($rol, self::ROLES, true)) {
            $rol = null;
        }

        $soloActivos = Peticion::queryString($request, 'incluir_inactivos') !== '1';

        return ApiResponse::success($response, $this->usuarios->listar($rol, $soloActivos));
    }

    /** GET /api/usuarios/{id} */
    public function show(Request $request, Response $response, array $args): Response
    {
        $perfil = $this->usuarios->perfil((int) $args['id']);

        if ($perfil === null) {
            throw ApiException::notFound('El usuario');
        }

        return ApiResponse::success($response, $perfil);
    }

    /** POST /api/usuarios */
    public function store(Request $request, Response $response): Response
    {
        $body = Peticion::body($request);

        $datos = $this->validarDatos($body, 'admin');

        $extra = (new Validator($body))
            ->required('rol')->in('rol', self::ROLES)
            ->required('password')->minLen('password', 8)->maxLen('password', 200)
            ->validate();

        if ($extra['rol'] === 'veterinario' && empty($datos['matricula'])) {
            throw new ValidationException(['matricula' => 'La matricula es obligatoria para un veterinario.']);
        }

        $id = $this->usuarios->crearConPassword(
            $datos + ['rol' => $extra['rol']],
            (string) $extra['password']
        );

        return ApiResponse::success(
            $response,
            $this->usuarios->perfil($id),
            'Usuario creado.',
            201
        );
    }

    /** PUT /api/usuarios/{id} */
    public function update(Request $request, Response $response, array $args): Response
    {
        $id     = (int) $args['id'];
        $perfil = $this->usuarios->perfil($id);

        if ($perfil === null) {
            throw ApiException::notFound('El usuario');
        }

        $body  = Peticion::body($request);
        $datos = $this->validarDatos($body, 'admin', $id);

        // El rol viaja aparte de la whitelist del modelo, a proposito.
        $rolNuevo = null;

        if (array_key_exists('rol', $body) && $body['rol'] !== null && $body['rol'] !== '') {
            $rolNuevo = (new Validator($body))->required('rol')->in('rol', self::ROLES)->validate()['rol'];

            if ($rolNuevo === 'veterinario' && empty($datos['matricula']) && empty($perfil['matricula'])) {
                throw new ValidationException(['matricula' => 'La matricula es obligatoria para un veterinario.']);
            }
        }

        $yo = (int) $request->getAttribute('usuario_id');

        // Un admin no puede quitarse a si mismo el rol de admin: seria la via
        // mas facil de quedarse sin ningun administrador en el sistema.
        if ($rolNuevo !== null && $rolNuevo !== 'admin' && $id === $yo) {
            throw ApiException::conflict('No podes quitarte a vos mismo el rol de administrador.');
        }

        if ($rolNuevo !== null && $rolNuevo !== 'admin' && $perfil['rol'] === 'admin') {
            $this->verificarUltimoAdmin($id);
        }

        $this->usuarios->actualizar($id, $datos);

        if ($rolNuevo !== null && $rolNuevo !== $perfil['rol']) {
            $this->usuarios->cambiarRol($id, $rolNuevo);

            // Cambiar el rol invalida los access token vigentes, que llevan el
            // rol dentro. Se cierran las sesiones para que el usuario vuelva a
            // entrar con sus permisos nuevos.
            $this->tokens->revocarTodosDelUsuario($id);
        }

        return ApiResponse::success($response, $this->usuarios->perfil($id), 'Usuario actualizado.');
    }

    /**
     * PATCH /api/usuarios/{id}/estado
     *
     * Alta y baja. No se borra el usuario: sus consultas, turnos y firmas
     * quedan referenciandolo.
     */
    public function cambiarEstado(Request $request, Response $response, array $args): Response
    {
        $id     = (int) $args['id'];
        $perfil = $this->usuarios->perfil($id);

        if ($perfil === null) {
            throw ApiException::notFound('El usuario');
        }

        $datos = (new Validator(Peticion::body($request)))
            ->required('activo')
            ->validate();

        $activo = filter_var($datos['activo'], FILTER_VALIDATE_BOOLEAN);
        $yo     = (int) $request->getAttribute('usuario_id');

        if (!$activo && $id === $yo) {
            throw ApiException::conflict('No podes desactivar tu propia cuenta.');
        }

        if (!$activo && $perfil['rol'] === 'admin') {
            $this->verificarUltimoAdmin($id);
        }

        $this->usuarios->actualizar($id, ['activo' => $activo ? 1 : 0]);

        if (!$activo) {
            // Desactivar debe expulsar de inmediato, no cuando venza el token.
            $this->tokens->revocarTodosDelUsuario($id);
        }

        return ApiResponse::success(
            $response,
            $this->usuarios->perfil($id),
            $activo ? 'Usuario activado.' : 'Usuario desactivado.'
        );
    }

    /**
     * POST /api/usuarios/{id}/password
     *
     * Reseteo por parte de un admin: no pide la contrasena actual, porque el
     * caso de uso es justamente que el usuario la olvido.
     */
    public function resetearPassword(Request $request, Response $response, array $args): Response
    {
        $id = (int) $args['id'];

        if ($this->usuarios->perfil($id) === null) {
            throw ApiException::notFound('El usuario');
        }

        $datos = (new Validator(Peticion::body($request)))
            ->required('password')->minLen('password', 8)->maxLen('password', 200)
            ->validate();

        $this->usuarios->actualizarPassword($id, (string) $datos['password']);
        $this->tokens->revocarTodosDelUsuario($id);

        return ApiResponse::success($response, null, 'Contrasena restablecida. Se cerraron sus sesiones.');
    }

    // ================================ apoyo ================================ //

    /**
     * Campos de contacto comunes al perfil propio y al alta/edicion por admin.
     *
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    private function validarDatos(array $body, string $rolQuienEdita, ?int $exceptoId = null): array
    {
        $datos = (new Validator($body))
            ->required('nombre')->maxLen('nombre', 80)
            ->required('apellido')->maxLen('apellido', 80)
            ->required('email')->email('email')->maxLen('email', 150)
            ->optional('telefono')->maxLen('telefono', 30)
            ->optional('matricula')->maxLen('matricula', 50)
            ->validate();

        $datos['email'] = strtolower((string) $datos['email']);

        if ($this->usuarios->emailEnUso($datos['email'], $exceptoId)) {
            throw new ValidationException(['email' => 'Ya existe otro usuario con ese email.']);
        }

        return $datos;
    }

    /** Impide dejar el sistema sin ningun administrador activo. */
    private function verificarUltimoAdmin(int $idExcluido): void
    {
        $admins = array_filter(
            $this->usuarios->listar('admin', true),
            static fn (array $u): bool => (int) $u['id'] !== $idExcluido
        );

        if ($admins === []) {
            throw ApiException::conflict(
                'Es el unico administrador activo. Designa otro antes de hacer este cambio.'
            );
        }
    }
}
