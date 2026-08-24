<?php

declare(strict_types=1);

namespace App\Models;

use InvalidArgumentException;
use PDO;

/**
 * CRUD reutilizable sobre PDO con sentencias preparadas.
 *
 * Regla de oro que aplica toda esta clase: los VALORES siempre van como
 * parametros ligados; los IDENTIFICADORES (nombres de columna, direccion de
 * ordenamiento) nunca pueden parametrizarse en SQL, asi que se validan contra
 * la whitelist `$camposPermitidos` de cada modelo concreto. Un ORDER BY
 * armado por concatenacion es la via de inyeccion que mas se olvida.
 */
abstract class BaseModel
{
    protected PDO $db;

    /** Nombre de la tabla. */
    protected string $tabla = '';

    /** Columnas escribibles desde la API. Actua como whitelist de asignacion masiva. */
    protected array $camposPermitidos = [];

    /** Columnas por las que se permite ordenar. */
    protected array $ordenPermitido = ['id'];

    /** Si la tabla usa baja logica via deleted_at. */
    protected bool $bajaLogica = false;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /** @return array<string,mixed>|null */
    public function buscarPorId(int $id): ?array
    {
        $sql = "SELECT * FROM {$this->tabla} WHERE id = :id";

        if ($this->bajaLogica) {
            $sql .= ' AND deleted_at IS NULL';
        }

        $stmt = $this->db->prepare($sql . ' LIMIT 1');
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    public function existe(int $id): bool
    {
        return $this->buscarPorId($id) !== null;
    }

    /**
     * @param array<string,mixed> $datos
     * @return int ID insertado.
     */
    public function crear(array $datos): int
    {
        $datos = $this->filtrarCampos($datos);

        if ($datos === []) {
            throw new InvalidArgumentException('No hay campos validos para insertar.');
        }

        $columnas     = array_keys($datos);
        $placeholders = array_map(static fn (string $c): string => ':' . $c, $columnas);

        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->tabla,
            implode(', ', $columnas),
            implode(', ', $placeholders)
        );

        $this->db->prepare($sql)->execute($datos);

        return (int) $this->db->lastInsertId();
    }

    /**
     * @param array<string,mixed> $datos
     * @return bool true si la fila existia y se intento actualizar.
     */
    public function actualizar(int $id, array $datos): bool
    {
        $datos = $this->filtrarCampos($datos);

        if ($datos === []) {
            return false;
        }

        $asignaciones = array_map(
            static fn (string $c): string => "$c = :$c",
            array_keys($datos)
        );

        $sql = sprintf(
            'UPDATE %s SET %s WHERE id = :id',
            $this->tabla,
            implode(', ', $asignaciones)
        );

        if ($this->bajaLogica) {
            $sql .= ' AND deleted_at IS NULL';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($datos + ['id' => $id]);

        // rowCount() da 0 si se envio el mismo valor que ya estaba; por eso se
        // consulta la existencia en lugar de confiar en el contador.
        return $stmt->rowCount() > 0 || $this->existe($id);
    }

    /**
     * Baja logica si la tabla la soporta, fisica en caso contrario.
     */
    public function eliminar(int $id): bool
    {
        $sql = $this->bajaLogica
            ? "UPDATE {$this->tabla} SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL"
            : "DELETE FROM {$this->tabla} WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Quita del array de entrada todo lo que no este declarado como
     * escribible. Sin esto, un `PUT` con `{"rol":"admin"}` escribiria esa
     * columna aunque el endpoint no la contemple.
     *
     * @param array<string,mixed> $datos
     * @return array<string,mixed>
     */
    protected function filtrarCampos(array $datos): array
    {
        return array_intersect_key($datos, array_flip($this->camposPermitidos));
    }

    /**
     * Valida columna y direccion de ordenamiento contra la whitelist.
     *
     * @return array{0:string,1:string}
     */
    protected function ordenSeguro(?string $columna, ?string $direccion): array
    {
        $col = in_array((string) $columna, $this->ordenPermitido, true)
            ? (string) $columna
            : $this->ordenPermitido[0];

        $dir = strtoupper((string) $direccion) === 'DESC' ? 'DESC' : 'ASC';

        return [$col, $dir];
    }

    /**
     * LIMIT/OFFSET como enteros casteados, no como parametros ligados: con
     * EMULATE_PREPARES=false MySQL trata los parametros de LIMIT como strings
     * y falla. El casteo a int es seguro porque elimina cualquier contenido
     * no numerico.
     *
     * @return array{0:int,1:int} [limit, offset]
     */
    protected function paginacion(int $page, int $perPage, int $maxPerPage = 100): array
    {
        $perPage = max(1, min($perPage, $maxPerPage));
        $page    = max(1, $page);

        return [$perPage, ($page - 1) * $perPage];
    }
}
