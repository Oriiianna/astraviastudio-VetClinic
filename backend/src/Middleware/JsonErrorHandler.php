<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Exceptions\ApiException;
use App\Exceptions\ValidationException;
use App\Support\ApiResponse;
use PDOException;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Throwable;

/**
 * Convierte cualquier excepcion en una respuesta JSON con la forma estandar.
 *
 * El punto clave es la separacion entre errores "esperados" y el resto:
 *
 *  - ApiException / ValidationException llevan mensajes escritos para que los
 *    lea un usuario, asi que se muestran tal cual.
 *  - Todo lo demas (PDOException incluida) se registra completo en el log y al
 *    cliente le llega un 500 generico. Un mensaje de PDO puede contener
 *    fragmentos de SQL, nombres de tabla y hasta credenciales: nunca sale.
 *
 * En APP_ENV=development se adjunta el detalle tecnico bajo la clave `debug`
 * para no tener que ir al log en cada iteracion.
 */
final class JsonErrorHandler
{
    private ResponseFactoryInterface $responseFactory;
    private LoggerInterface $logger;
    private bool $debug;

    public function __construct(ResponseFactoryInterface $responseFactory, LoggerInterface $logger, bool $debug)
    {
        $this->responseFactory = $responseFactory;
        $this->logger          = $logger;
        $this->debug           = $debug;
    }

    public function __invoke(
        Request $request,
        Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails
    ): Response {
        $response = $this->responseFactory->createResponse();

        if ($exception instanceof ValidationException) {
            return ApiResponse::error($response, $exception->getMessage(), 422, $exception->getErrors());
        }

        if ($exception instanceof ApiException) {
            $status = $exception->getCode();
            $status = ($status >= 400 && $status < 600) ? (int) $status : 400;

            return ApiResponse::error($response, $exception->getMessage(), $status);
        }

        if ($exception instanceof HttpNotFoundException) {
            return ApiResponse::error($response, 'El endpoint solicitado no existe.', 404);
        }

        if ($exception instanceof HttpMethodNotAllowedException) {
            return ApiResponse::error($response, 'Metodo HTTP no permitido para este endpoint.', 405);
        }

        // --- A partir de aqui: error no previsto ---

        $this->logger->error($exception->getMessage(), [
            'excepcion' => get_class($exception),
            'archivo'   => $exception->getFile() . ':' . $exception->getLine(),
            'metodo'    => $request->getMethod(),
            'uri'       => (string) $request->getUri(),
            'trace'     => $exception->getTraceAsString(),
        ]);

        $mensaje = $exception instanceof PDOException
            ? 'Error al acceder a los datos. Intentalo nuevamente.'
            : 'Ocurrio un error inesperado. Intentalo nuevamente.';

        $errores = $this->debug ? [
            'debug' => [
                'excepcion' => get_class($exception),
                'mensaje'   => $exception->getMessage(),
                'archivo'   => $exception->getFile() . ':' . $exception->getLine(),
            ],
        ] : null;

        return ApiResponse::error($response, $mensaje, 500, $errores);
    }
}
