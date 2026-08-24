<?php

declare(strict_types=1);

/**
 * Rutas de la API. Todo cuelga de /api.
 *
 * Convencion de permisos por rol:
 *   - recepcionista : agenda, clientes y pacientes (no escribe historial clinico)
 *   - veterinario   : todo lo anterior + historial clinico
 *   - admin         : todo + gestion de usuarios
 *
 * NOTA: los closures de rutas y grupos NO pueden declararse `static`.
 * Slim los vincula al contenedor con Closure::bindTo(), que devuelve null
 * sobre un closure estatico y hace fallar el CallableResolver.
 */

use App\Controllers\AdjuntoController;
use App\Controllers\AuthController;
use App\Controllers\ClienteController;
use App\Controllers\ConsultaController;
use App\Controllers\PacienteController;
use App\Controllers\SanidadController;
use App\Controllers\TurnoController;
use App\Controllers\UsuarioController;
use App\Middleware\JwtAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Support\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Exception\HttpNotFoundException;
use Slim\Routing\RouteCollectorProxy;

return static function (App $app): void {
    // Se pasa el NOMBRE de la clase, no una instancia: Slim la resuelve del
    // contenedor recien cuando la ruta se ejecuta. Con `$container->get()`
    // aqui, el middleware -y con el la conexion PDO- se construiria al
    // definir las rutas, o sea en cada peticion, incluidas /health y /login.
    $auth = JwtAuthMiddleware::class;

    // Roles con acceso a la ficha administrativa (clientes, mascotas, agenda).
    $staff = ['admin', 'veterinario', 'recepcionista'];

    // Acceso al historial clinico: la recepcion queda fuera.
    $clinico = ['admin', 'veterinario'];

    $app->group('/api', function (RouteCollectorProxy $api) use ($auth, $staff, $clinico): void {

        // ------------------------------------------------------- health --
        // No toca la base de datos: sirve para verificar que el proceso PHP
        // responde aunque MySQL este caido.
        $api->get('/health', function (Request $request, Response $response) {
            return ApiResponse::success($response, [
                'estado' => 'ok',
                'hora'   => date('c'),
                'php'    => PHP_VERSION,
            ]);
        });

        // --------------------------------------------------------- auth --
        $api->group('/auth', function (RouteCollectorProxy $g) use ($auth): void {
            // Publicas
            $g->post('/login', [AuthController::class, 'login']);
            $g->post('/refresh', [AuthController::class, 'refresh']);
            $g->post('/logout', [AuthController::class, 'logout']);

            // Requieren access token
            $g->get('/me', [AuthController::class, 'me'])->add($auth);
            $g->post('/password', [AuthController::class, 'cambiarPassword'])->add($auth);

            // Cualquier usuario edita SUS datos. El id sale del token, nunca
            // de la URL, asi que no hay forma de editar el perfil de otro.
            $g->put('/perfil', [UsuarioController::class, 'actualizarPerfil'])->add($auth);
        });

        // ----------------------------------------------------- clientes --
        $api->group('/clientes', function (RouteCollectorProxy $g): void {
            $g->get('', [ClienteController::class, 'index']);
            $g->get('/{id:[0-9]+}', [ClienteController::class, 'show']);
            $g->post('', [ClienteController::class, 'store']);
            $g->put('/{id:[0-9]+}', [ClienteController::class, 'update']);

            // La baja queda reservada a admin: es la operacion con mas
            // potencial de dano y la que menos hace falta en el dia a dia.
            $g->delete('/{id:[0-9]+}', [ClienteController::class, 'destroy'])
              ->add(new RoleMiddleware(['admin']));
        })
        ->add(new RoleMiddleware($staff))
        ->add($auth);   // se ejecuta primero: sin JWT valido no hay rol que evaluar

        // ---------------------------------------------------- pacientes --
        $api->group('/pacientes', function (RouteCollectorProxy $g): void {
            $g->get('', [PacienteController::class, 'index']);
            $g->get('/{id:[0-9]+}', [PacienteController::class, 'show']);
            $g->post('', [PacienteController::class, 'store']);
            $g->put('/{id:[0-9]+}', [PacienteController::class, 'update']);

            // Igual que en clientes: la baja definitiva queda para admin.
            // El resto del staff marca `fallecido`, que conserva la ficha.
            $g->delete('/{id:[0-9]+}', [PacienteController::class, 'destroy'])
              ->add(new RoleMiddleware(['admin']));
        })
        ->add(new RoleMiddleware($staff))
        ->add($auth);

        // ----------------------------------------------------- catalogo --
        // Especies con sus razas anidadas: alimenta los selects del alta de
        // pacientes. Solo lectura, pero igual detras del login.
        $api->get('/especies', [PacienteController::class, 'especies'])
            ->add(new RoleMiddleware($staff))
            ->add($auth);

        // Veterinarios activos: selector de la agenda. Lo necesita tambien la
        // recepcionista para asignar turnos, por eso es $staff.
        $api->get('/veterinarios', [TurnoController::class, 'veterinarios'])
            ->add(new RoleMiddleware($staff))
            ->add($auth);

        // -------------------------------------------- historial clinico --
        // TODO el modulo -incluida la lectura- queda restringido a admin y
        // veterinario: la recepcion no debe ver diagnosticos. Coincide con
        // PERMISOS en el frontend, que no le da 'historial' a recepcionista.
        $api->group('/consultas', function (RouteCollectorProxy $g): void {
            $g->get('', [ConsultaController::class, 'index']);
            $g->get('/{id:[0-9]+}', [ConsultaController::class, 'show']);
            $g->post('', [ConsultaController::class, 'store']);
            $g->put('/{id:[0-9]+}', [ConsultaController::class, 'update']);

            // Borrar un registro medico es excepcional: solo admin.
            $g->delete('/{id:[0-9]+}', [ConsultaController::class, 'destroy'])
              ->add(new RoleMiddleware(['admin']));
        })
        ->add(new RoleMiddleware($clinico))
        ->add($auth);

        // Linea de tiempo completa de un paciente (consultas + vacunas +
        // desparasitaciones) en una sola respuesta.
        $api->get('/pacientes/{id:[0-9]+}/historial', [ConsultaController::class, 'historialPaciente'])
            ->add(new RoleMiddleware($clinico))
            ->add($auth);

        // ------------------------------------ vacunas y desparasitaciones --
        // Un mismo controlador atiende ambas: el tipo se deduce del path.
        foreach (['vacunas', 'desparasitaciones'] as $recurso) {
            $api->group("/$recurso", function (RouteCollectorProxy $g): void {
                $g->post('', [SanidadController::class, 'store']);
                $g->put('/{id:[0-9]+}', [SanidadController::class, 'update']);
                $g->delete('/{id:[0-9]+}', [SanidadController::class, 'destroy']);
            })
            ->add(new RoleMiddleware($clinico))
            ->add($auth);

            $api->get("/pacientes/{id:[0-9]+}/$recurso", [SanidadController::class, 'index'])
                ->add(new RoleMiddleware($clinico))
                ->add($auth);
        }

        // Vencimientos proximos. Lo ve tambien la recepcion: es quien llama
        // al cliente para avisarle que le toca la vacuna.
        $api->get('/recordatorios', [SanidadController::class, 'recordatorios'])
            ->add(new RoleMiddleware($staff))
            ->add($auth);

        // -------------------------------------- documentos del paciente --
        // Historias clinicas escaneadas, estudios, consentimientos. Los
        // binarios viven fuera de public/ y se sirven por /archivo, que exige
        // sesion: son registros medicos.
        $api->group('/pacientes/{id:[0-9]+}/adjuntos', function (RouteCollectorProxy $g): void {
            $g->get('', [AdjuntoController::class, 'index']);
            $g->post('', [AdjuntoController::class, 'store']);
        })
        ->add(new RoleMiddleware($staff))
        ->add($auth);

        $api->group('/adjuntos', function (RouteCollectorProxy $g): void {
            $g->get('/{id:[0-9]+}/archivo', [AdjuntoController::class, 'descargar']);
            $g->put('/{id:[0-9]+}', [AdjuntoController::class, 'update']);
            $g->delete('/{id:[0-9]+}', [AdjuntoController::class, 'destroy']);
        })
        ->add(new RoleMiddleware($staff))
        ->add($auth);

        // ------------------------------------------ usuarios (solo admin) --
        $api->group('/usuarios', function (RouteCollectorProxy $g): void {
            $g->get('', [UsuarioController::class, 'index']);
            $g->get('/{id:[0-9]+}', [UsuarioController::class, 'show']);
            $g->post('', [UsuarioController::class, 'store']);
            $g->put('/{id:[0-9]+}', [UsuarioController::class, 'update']);
            $g->patch('/{id:[0-9]+}/estado', [UsuarioController::class, 'cambiarEstado']);
            $g->post('/{id:[0-9]+}/password', [UsuarioController::class, 'resetearPassword']);
        })
        ->add(new RoleMiddleware(['admin']))
        ->add($auth);

        // ------------------------------------------------------- turnos --
        $api->group('/turnos', function (RouteCollectorProxy $g): void {
            // `/resumen` va ANTES que `/{id}`: si no, FastRoute intentaria
            // interpretar "resumen" como un id.
            $g->get('/resumen', [TurnoController::class, 'resumen']);
            $g->get('', [TurnoController::class, 'index']);
            $g->get('/{id:[0-9]+}', [TurnoController::class, 'show']);
            $g->post('', [TurnoController::class, 'store']);
            $g->put('/{id:[0-9]+}', [TurnoController::class, 'update']);

            // Operacion mas frecuente del dia: marcar en sala / atendido.
            $g->patch('/{id:[0-9]+}/estado', [TurnoController::class, 'cambiarEstado']);

            $g->delete('/{id:[0-9]+}', [TurnoController::class, 'destroy'])
              ->add(new RoleMiddleware(['admin']));
        })
        ->add(new RoleMiddleware($staff))
        ->add($auth);
    });

    // Catch-all: debe ir SIEMPRE al final. Convierte cualquier ruta no
    // reconocida en un 404 JSON en lugar de una pagina HTML de Slim.
    $app->map(
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        '/{ruta:.*}',
        function (Request $request): void {
            throw new HttpNotFoundException($request);
        }
    );
};
