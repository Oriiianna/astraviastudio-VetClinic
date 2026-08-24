<?php

declare(strict_types=1);

/**
 * Definiciones del contenedor (PHP-DI).
 *
 * PHP-DI resuelve por autowiring casi todo lo que tenga type hints, asi que
 * aqui solo se declara lo que necesita construccion explicita: la conexion
 * PDO, el logger y los servicios que reciben arrays de configuracion.
 */

use App\Controllers\AdjuntoController;
use App\Controllers\AuthController;
use App\Controllers\ClienteController;
use App\Controllers\ConsultaController;
use App\Controllers\PacienteController;
use App\Controllers\SanidadController;
use App\Controllers\TurnoController;
use App\Controllers\UsuarioController;
use App\Middleware\CorsMiddleware;
use App\Middleware\JsonErrorHandler;
use App\Middleware\JwtAuthMiddleware;
use App\Models\Adjunto;
use App\Models\Catalogo;
use App\Models\Cliente;
use App\Models\Consulta;
use App\Models\Paciente;
use App\Models\Sanidad;
use App\Models\Turno;
use App\Models\Usuario;
use App\Services\AuthService;
use App\Services\TokenService;
use App\Support\Almacenamiento;
use App\Support\Database;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Log\LoggerInterface;
use Slim\Psr7\Factory\ResponseFactory;

return [
    // --- Configuracion ---
    'settings' => static fn (): array => require __DIR__ . '/settings.php',

    // --- Infraestructura ---
    PDO::class => static function (ContainerInterface $c): PDO {
        return Database::connect($c->get('settings')['db']);
    },

    LoggerInterface::class => static function (ContainerInterface $c): LoggerInterface {
        $settings = $c->get('settings');
        $logger   = new Logger($settings['name']);

        $nivel = $settings['logs']['nivel'] === 'debug' ? Level::Debug : Level::Warning;

        // Rotacion diaria con 14 dias de retencion: un log unico crece sin
        // limite y termina llenando el disco del servidor.
        $logger->pushHandler(new RotatingFileHandler($settings['logs']['ruta'], 14, $nivel));

        if ($settings['debug']) {
            $logger->pushHandler(new StreamHandler('php://stderr', Level::Debug));
        }

        return $logger;
    },

    ResponseFactoryInterface::class => static fn (): ResponseFactoryInterface => new ResponseFactory(),

    // --- Modelos ---
    Usuario::class  => static fn (ContainerInterface $c): Usuario => new Usuario($c->get(PDO::class)),
    Cliente::class  => static fn (ContainerInterface $c): Cliente => new Cliente($c->get(PDO::class)),
    Paciente::class => static fn (ContainerInterface $c): Paciente => new Paciente($c->get(PDO::class)),
    Catalogo::class => static fn (ContainerInterface $c): Catalogo => new Catalogo($c->get(PDO::class)),
    Consulta::class => static fn (ContainerInterface $c): Consulta => new Consulta($c->get(PDO::class)),
    Sanidad::class  => static fn (ContainerInterface $c): Sanidad => new Sanidad($c->get(PDO::class)),
    Turno::class    => static fn (ContainerInterface $c): Turno => new Turno($c->get(PDO::class)),
    Adjunto::class  => static fn (ContainerInterface $c): Adjunto => new Adjunto($c->get(PDO::class)),

    // Almacenamiento de adjuntos: FUERA del document root a proposito, son
    // registros medicos y no deben ser alcanzables por URL directa.
    Almacenamiento::class => static function (ContainerInterface $c): Almacenamiento {
        return new Almacenamiento($c->get('settings')['storage_dir']);
    },

    // --- Servicios ---
    TokenService::class => static function (ContainerInterface $c): TokenService {
        return new TokenService($c->get(PDO::class), $c->get('settings')['jwt']);
    },

    AuthService::class => static function (ContainerInterface $c): AuthService {
        return new AuthService(
            $c->get(PDO::class),
            $c->get(Usuario::class),
            $c->get(TokenService::class),
            $c->get('settings')['login']
        );
    },

    // --- Middleware ---
    CorsMiddleware::class => static function (ContainerInterface $c): CorsMiddleware {
        return new CorsMiddleware(
            $c->get('settings')['cors'],
            $c->get(ResponseFactoryInterface::class)
        );
    },

    JwtAuthMiddleware::class => static function (ContainerInterface $c): JwtAuthMiddleware {
        return new JwtAuthMiddleware($c->get(TokenService::class));
    },

    JsonErrorHandler::class => static function (ContainerInterface $c): JsonErrorHandler {
        return new JsonErrorHandler(
            $c->get(ResponseFactoryInterface::class),
            $c->get(LoggerInterface::class),
            $c->get('settings')['debug']
        );
    },

    // --- Controladores ---
    AuthController::class => static function (ContainerInterface $c): AuthController {
        return new AuthController(
            $c->get(AuthService::class),
            $c->get(Usuario::class),
            $c->get('settings')
        );
    },

    ClienteController::class => static function (ContainerInterface $c): ClienteController {
        return new ClienteController($c->get(Cliente::class));
    },

    PacienteController::class => static function (ContainerInterface $c): PacienteController {
        return new PacienteController(
            $c->get(Paciente::class),
            $c->get(Cliente::class),
            $c->get(Catalogo::class)
        );
    },

    ConsultaController::class => static function (ContainerInterface $c): ConsultaController {
        return new ConsultaController(
            $c->get(Consulta::class),
            $c->get(Paciente::class),
            $c->get(Sanidad::class)
        );
    },

    SanidadController::class => static function (ContainerInterface $c): SanidadController {
        return new SanidadController($c->get(Sanidad::class), $c->get(Paciente::class));
    },

    AdjuntoController::class => static function (ContainerInterface $c): AdjuntoController {
        return new AdjuntoController(
            $c->get(Adjunto::class),
            $c->get(Paciente::class),
            $c->get(Almacenamiento::class)
        );
    },

    UsuarioController::class => static function (ContainerInterface $c): UsuarioController {
        return new UsuarioController($c->get(Usuario::class), $c->get(TokenService::class));
    },

    TurnoController::class => static function (ContainerInterface $c): TurnoController {
        return new TurnoController(
            $c->get(Turno::class),
            $c->get(Paciente::class),
            $c->get(Usuario::class)
        );
    },
];
