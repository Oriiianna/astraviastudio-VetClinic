<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\ValidationException;
use Psr\Http\Message\UploadedFileInterface;
use RuntimeException;

/**
 * Guardado de archivos subidos.
 *
 * Decision central: los archivos NO viven en public/. Ese directorio lo sirve
 * el servidor web de forma estatica, asi que cualquiera con la URL podria leer
 * la historia clinica de un paciente sin estar autenticado. Los adjuntos van a
 * backend/storage/ -fuera del document root- y se entregan por un endpoint que
 * verifica sesion y permisos.
 *
 * Reglas que aplica esta clase:
 *
 *  - El MIME se determina con finfo sobre el archivo REAL, nunca con el que
 *    declara el cliente (que es texto libre y se falsea trivialmente).
 *  - La extension sale de la whitelist interna, jamas del nombre original. Es
 *    lo que cierra la puerta a subir "informe.php" y lograr que se ejecute.
 *  - El nombre en disco es aleatorio; el original solo se guarda en la base
 *    para mostrarlo y para la descarga.
 */
final class Almacenamiento
{
    /** MIME real => extension que se usara en disco. */
    private const PERMITIDOS = [
        'application/pdf' => 'pdf',
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'image/webp'      => 'webp',
        'image/gif'       => 'gif',
        'image/tiff'      => 'tiff',
        'text/plain'      => 'txt',
    ];

    /**
     * Los formatos de Office son archivos ZIP por dentro, asi que finfo los
     * reporta como application/zip y no hay forma fiable de distinguir un
     * .docx legitimo de un zip arbitrario. Se dejan fuera a proposito: para
     * documentacion clinica, el PDF es el formato correcto de todos modos.
     */
    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    private string $raiz;

    public function __construct(string $raiz)
    {
        $this->raiz = rtrim($raiz, '/\\');
    }

    /**
     * Valida y guarda el archivo.
     *
     * @param string $subcarpeta Se sanea a [a-z0-9_-]; nunca llega del cliente.
     * @return array{ruta:string, mime:string, tamano:int, nombre_original:string}
     * @throws ValidationException
     */
    public function guardar(UploadedFileInterface $archivo, string $subcarpeta): array
    {
        $this->verificarError($archivo);

        $tamano = (int) $archivo->getSize();

        if ($tamano <= 0) {
            throw new ValidationException(['archivo' => 'El archivo esta vacio.']);
        }

        if ($tamano > self::MAX_BYTES) {
            $mb = (int) (self::MAX_BYTES / 1024 / 1024);

            throw new ValidationException(['archivo' => "El archivo supera el maximo de {$mb} MB."]);
        }

        // MIME real del contenido, no el declarado por el navegador.
        $mime = $this->detectarMime($archivo);

        if (!isset(self::PERMITIDOS[$mime])) {
            throw new ValidationException([
                'archivo' => 'Formato no permitido. Se aceptan PDF, imagenes (JPG, PNG, WEBP, GIF, TIFF) y texto plano.',
            ]);
        }

        $extension  = self::PERMITIDOS[$mime];
        $carpeta    = preg_replace('/[^a-z0-9_-]/i', '', $subcarpeta) ?: 'general';
        $destinoDir = $this->raiz . DIRECTORY_SEPARATOR . $carpeta;

        if (!is_dir($destinoDir) && !mkdir($destinoDir, 0775, true) && !is_dir($destinoDir)) {
            throw new RuntimeException('No se pudo crear el directorio de almacenamiento.');
        }

        // Nombre aleatorio: sin relacion con el original, sin traversal posible.
        $nombreDisco = bin2hex(random_bytes(16)) . '.' . $extension;

        $archivo->moveTo($destinoDir . DIRECTORY_SEPARATOR . $nombreDisco);

        return [
            // Ruta RELATIVA a la raiz de almacenamiento: si manana cambia la
            // ubicacion fisica, no hay que reescribir la base.
            'ruta'            => $carpeta . '/' . $nombreDisco,
            'mime'            => $mime,
            'tamano'          => $tamano,
            'nombre_original' => $this->limpiarNombre($archivo->getClientFilename() ?? 'archivo'),
        ];
    }

    /**
     * Ruta absoluta de un adjunto ya guardado.
     *
     * Comprueba que el resultado siga dentro de la raiz: aunque la ruta salga
     * de nuestra propia base, un valor manipulado (por ejemplo "../../.env")
     * no debe poder escaparse del directorio.
     */
    public function rutaAbsoluta(string $rutaRelativa): ?string
    {
        $candidata = $this->raiz . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rutaRelativa);
        $real      = realpath($candidata);
        $raizReal  = realpath($this->raiz);

        if ($real === false || $raizReal === false) {
            return null;
        }

        if (!str_starts_with($real, $raizReal . DIRECTORY_SEPARATOR)) {
            return null;
        }

        return $real;
    }

    public function eliminar(string $rutaRelativa): bool
    {
        $ruta = $this->rutaAbsoluta($rutaRelativa);

        return $ruta !== null && is_file($ruta) && unlink($ruta);
    }

    private function verificarError(UploadedFileInterface $archivo): void
    {
        if ($archivo->getError() === UPLOAD_ERR_OK) {
            return;
        }

        // El caso frecuente es superar upload_max_filesize/post_max_size del
        // php.ini, que ocurre ANTES de que la aplicacion pueda medir nada.
        $mensaje = match ($archivo->getError()) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
                'El archivo es demasiado grande para el servidor. Revisa upload_max_filesize en php.ini.',
            UPLOAD_ERR_PARTIAL   => 'La subida se interrumpio. Intentalo de nuevo.',
            UPLOAD_ERR_NO_FILE   => 'No se recibio ningun archivo.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
                'El servidor no pudo escribir el archivo temporal.',
            default => 'No se pudo procesar el archivo.',
        };

        throw new ValidationException(['archivo' => $mensaje]);
    }

    private function detectarMime(UploadedFileInterface $archivo): string
    {
        $flujo = $archivo->getStream();
        $flujo->rewind();

        // 4 KB alcanzan de sobra para los numeros magicos de cualquier formato.
        $muestra = $flujo->read(4096);
        $flujo->rewind();

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->buffer($muestra);

        return $mime === false ? 'application/octet-stream' : $mime;
    }

    /** Deja el nombre original presentable, sin rutas ni caracteres raros. */
    private function limpiarNombre(string $nombre): string
    {
        $nombre = basename(str_replace('\\', '/', $nombre));
        $nombre = preg_replace('/[^\w .,()\-]/u', '', $nombre) ?? 'archivo';

        return mb_substr(trim($nombre) ?: 'archivo', 0, 255);
    }
}
