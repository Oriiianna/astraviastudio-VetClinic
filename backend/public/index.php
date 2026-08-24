<?php

declare(strict_types=1);

/**
 * Front controller unico de la API.
 *
 * Todo el trafico entra por aqui (ver public/.htaccess). El resto del
 * proyecto vive fuera del document root, de modo que ni el .env ni el codigo
 * fuente son alcanzables por HTTP.
 */

use DI\ContainerBuilder;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

// --- Contenedor -------------------------------------------------------- //

$builder = new ContainerBuilder();
$builder->addDefinitions(require __DIR__ . '/../config/container.php');

$settingsPreview = require __DIR__ . '/../config/settings.php';

if (!$settingsPreview['debug']) {
    // Compilacion del contenedor: solo en produccion. En desarrollo obligaria
    // a borrar la cache tras cada cambio de definiciones.
    $builder->enableCompilation(__DIR__ . '/../var/cache');
}

$container = $builder->build();

// --- Errores de PHP ---------------------------------------------------- //

$settings = $container->get('settings');

// display_errors OFF siempre: cualquier warning impreso antes de las
// cabeceras rompe el JSON y puede filtrar rutas del servidor. Los errores
// se ven en el log y, en desarrollo, en el bloque `debug` de la respuesta.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting($settings['debug'] ? E_ALL : E_ALL & ~E_DEPRECATED & ~E_NOTICE);

date_default_timezone_set('America/Argentina/Cordoba');

// --- Aplicacion -------------------------------------------------------- //

AppFactory::setContainer($container);
$app = AppFactory::create();

// --- Middlewares & CORS ------------------------------------------------ //

// 1. Manejar preflight OPTIONS globalmente
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
    return $response;
});

// 2. Middleware de CORS dinámico
$app->add(function (Request $request, RequestHandler $handler): Response {
    $response = $handler->handle($request);

    $origin = $request->getHeaderLine('Origin');

    if (preg_match('/\.vercel\.app$/', $origin) || str_contains($origin, 'localhost')) {
        $allowedOrigin = $origin;
    } else {
        $allowedOrigin = '*';
    }

    return $response
        ->withHeader('Access-Control-Allow-Origin', $allowedOrigin)
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

(require __DIR__ . '/../config/middleware.php')($app);
(require __DIR__ . '/../routes/api.php')($app);

$app->run();
