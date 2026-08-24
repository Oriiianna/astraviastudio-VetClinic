<?php

declare(strict_types=1);

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
    $builder->enableCompilation(__DIR__ . '/../var/cache');
}

$container = $builder->build();

// --- Errores de PHP ---------------------------------------------------- //

$settings = $container->get('settings');

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting($settings['debug'] ? E_ALL : E_ALL & ~E_DEPRECATED & ~E_NOTICE);

date_default_timezone_set('America/Argentina/Cordoba');

// --- Aplicacion -------------------------------------------------------- //

AppFactory::setContainer($container);
$app = AppFactory::create();

// Cargar rutas y middlewares del sistema
(require __DIR__ . '/../config/middleware.php')($app);
(require __DIR__ . '/../routes/api.php')($app);

// Ruta comodín para capturar OPTIONS globales
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
    return $response;
});

// --- Middleware CORS (Debe ser el ÚLTIMO agregado para ejecutarse PRIMERO) --- //
$app->add(function (Request $request, RequestHandler $handler): Response {
    $origin = $request->getHeaderLine('Origin');
    $allowedOrigin = !empty($origin) ? $origin : '*';

    // Si es una petición PREFLIGHT (OPTIONS), responder inmediatamente 200 OK
    if ($request->getMethod() === 'OPTIONS') {
        $response = new \Slim\Psr7\Response();
        return $response
            ->withHeader('Access-Control-Allow-Origin', $allowedOrigin)
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization, X-Api-Key')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true')
            ->withStatus(200);
    }

    $response = $handler->handle($request);

    return $response
        ->withHeader('Access-Control-Allow-Origin', $allowedOrigin)
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization, X-Api-Key')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

$app->run();
