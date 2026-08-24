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

(require __DIR__ . '/../config/middleware.php')($app);
(require __DIR__ . '/../routes/api.php')($app);

$app->run();
