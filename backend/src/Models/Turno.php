<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Turnos de la agenda.
 *
 * La regla dificil de este modulo es el solapamiento: un veterinario no puede
 * tener dos turnos superpuestos. MySQL no tiene constraints de exclusion
 * (el EXCLUDE de PostgreSQL), asi que la validacion vive en la aplicacion y
 * debe ejecutarse DENTRO de la misma transaccion que el INSERT, o dos
 * peticiones simultaneas pueden pasar ambas la comprobacion y crear el
 * conflicto igual.
 */
final class Turno extends BaseModel
{
    protected string $tabla = 'turnos';

    protected array $camposPermitidos = [
        'paciente_id', 'cliente_id', 'veterinario_id', 'fecha_hora_inicio',
        'fecha_hora_fin', 'motivo', 'tipo', 'estado', 'notas', 'creado_por',
    ];

    protected array $ordenPermitido = ['fecha_hora_inicio', 'created_at'];

    private const SELECT_BASE = "
        SELECT t.*,
               p.nombre   AS paciente_nombre,
               e.nombre   AS especie,
               c.nombre   AS cliente_nombre,
               c.apellido AS cliente_apellido,
               c.telefono AS cliente_telefono,
               u.nombre   AS veterinario_nombre,
               u.apellido AS veterinario_apellido
        FROM turnos t
        INNER JOIN pacientes p ON p.id = t.paciente_id
        INNER JOIN especies  e ON e.id = p.especie_id
        INNER JOIN clientes  c ON c.id = t.cliente_id
        INNER JOIN usuarios  u ON u.id = t.veterinario_id
    ";

    /**
     * Turnos dentro de un rango. La agenda pide una semana o un dia completo,
     * no paginado: se devuelven todos los del rango ordenados por hora.
     *
     * @return array<int,array<string,mixed>>
     */
    public function listarRango(
        string $desde,
        string $hasta,
        ?int $veterinarioId = null,
        ?string $estado = null,
        ?int $pacienteId = null
    ): array {
        $where  = ['t.fecha_hora_inicio >= :desde', 't.fecha_hora_inicio <= :hasta'];
        $params = ['desde' => $desde . ' 00:00:00', 'hasta' => $hasta . ' 23:59:59'];

        if ($veterinarioId !== null) {
            $where[] = 't.veterinario_id = :vet';
            $params['vet'] = $veterinarioId;
        }

        if ($estado !== null) {
            $where[] = 't.estado = :estado';
            $params['estado'] = $estado;
        }

        if ($pacienteId !== null) {
            $where[] = 't.paciente_id = :paciente';
            $params['paciente'] = $pacienteId;
        }

        $stmt = $this->db->prepare(
            self::SELECT_BASE . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY t.fecha_hora_inicio'
        );
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function buscarCompleto(int $id): ?array
    {
        $stmt = $this->db->prepare(self::SELECT_BASE . ' WHERE t.id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    /**
     * Turnos del veterinario que se cruzan con el rango dado.
     *
     * La condicion de solapamiento es `inicio_existente < fin_nuevo AND
     * fin_existente > inicio_nuevo`. Con `<=` un turno que termina 10:00 y
     * otro que empieza 10:00 se considerarian solapados, y son consecutivos.
     *
     * Los cancelados y los ausentes no bloquean: su horario queda libre.
     *
     * @return array<int,array<string,mixed>>
     */
    public function solapados(
        int $veterinarioId,
        string $inicio,
        string $fin,
        ?int $exceptoId = null
    ): array {
        $sql = "SELECT t.id, t.fecha_hora_inicio, t.fecha_hora_fin, t.motivo,
                       p.nombre AS paciente_nombre
                FROM turnos t
                INNER JOIN pacientes p ON p.id = t.paciente_id
                WHERE t.veterinario_id = :vet
                  AND t.estado NOT IN ('cancelado', 'ausente')
                  AND t.fecha_hora_inicio < :fin
                  AND t.fecha_hora_fin > :inicio";

        $params = ['vet' => $veterinarioId, 'inicio' => $inicio, 'fin' => $fin];

        if ($exceptoId !== null) {
            $sql .= ' AND t.id <> :id';
            $params['id'] = $exceptoId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function beginTransaction(): void
    {
        $this->db->beginTransaction();
    }

    public function commit(): void
    {
        $this->db->commit();
    }

    public function rollBack(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    public function cambiarEstado(int $id, string $estado): bool
    {
        $stmt = $this->db->prepare('UPDATE turnos SET estado = :estado WHERE id = :id');
        $stmt->execute(['estado' => $estado, 'id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Resumen del dia para el panel de inicio.
     *
     * @return array<string,int> estado => cantidad
     */
    public function resumenDelDia(?string $fecha = null): array
    {
        $fecha = $fecha ?? date('Y-m-d');

        $stmt = $this->db->prepare(
            'SELECT estado, COUNT(*) AS total
             FROM turnos
             WHERE DATE(fecha_hora_inicio) = :fecha
             GROUP BY estado'
        );
        $stmt->execute(['fecha' => $fecha]);

        $resumen = [];
        foreach ($stmt->fetchAll() as $fila) {
            $resumen[$fila['estado']] = (int) $fila['total'];
        }

        return $resumen;
    }
}
