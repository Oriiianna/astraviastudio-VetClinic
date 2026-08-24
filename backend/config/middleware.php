<?php

declare(strict_types=1);

/**
 * Pila de middleware global.
 *
 * ORDEN: Slim ejecuta los middleware en orden INVERSO al de registro (LIFO).
 * El ultimo que se agrega es el primero que corre. De ahi que CORS vaya al
 * final: necesita envolver a todos los demas para que incluso una respuesta
 * de error 500 o un 404 lleven las cabeceras. Sin eso, el navegador reporta
 * un fallo de CORS en lugar del error real y la depuracion se vuelve ciega.
 *
 * Orden de ejecucion resultante:
 *   CORS -> ErrorMiddleware -> Routing -> BodyParsing -> ruta
 */

use App\Middleware\CorsMiddleware;
use App\Middleware\JsonErrorHandler;
use Slim\App;

return static function (App $app): void {
    $container = $app->getContainer();
    $settings  = $container->get('settings');

    // Convierte el JSON entrante en array accesible via getParsedBody().
    $app->addBodyParsingMiddleware();

    // Resuelve la ruta. Debe ir antes del error middleware para que un 404
    // se propague como HttpNotFoundException y no como excepcion cruda.
    $app->addRoutingMiddleware();

    $errorMiddleware = $app->addErrorMiddleware(
        (bool) $settings['debug'],  // mostrar detalles
        true,                       // registrar errores
        true                        // registrar detalles
    );

    // Handler propio: toda respuesta de error sale en JSON con la forma
    // estandar de la API, nunca como pagina HTML de Slim.
    $errorMiddleware->setDefaultErrorHandler($container->get(JsonErrorHandler::class));

    // Ultimo en registrarse = primero en ejecutarse.
    $app->add($container->get(CorsMiddleware::class));
};
