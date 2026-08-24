<?php

declare(strict_types=1);

namespace App\Models;

use InvalidArgumentException;
use PDO;

/**
 * Vacunas y desparasitaciones.
 *
 * Las dos tablas tienen la misma forma (paciente, veterinario, producto,
 * fecha de aplicacion y fecha de la proxima), asi que se manejan con un solo
 * modelo parametrizado por tipo en vez de duplicar la clase entera.
 *
 * No extiende BaseModel porque la tabla se decide en tiempo de ejecucion, y
 * ese es justo el supuesto que BaseModel no contempla.
 */
final class Sanidad
{
    public const VACUNA = 'vacuna';
    public const DESPARASITACION = 'desparasitacion';

    /** Configuracion por tipo: tabla y columnas escribibles. */
    private const TIPOS = [
        self::VACUNA => [
            'tabla'  => 'vacunas',
            'campos' => [
                'paciente_id', 'consulta_id', 'veterinario_id', 'tipo_vacuna',
                'marca', 'lote', 'fecha_aplicacion', 'fecha_proxima', 'observaciones',
            ],
            'etiqueta' => 'tipo_vacuna',
        ],
        self::DESPARASITACION => [
            'tabla'  => 'desparasitaciones',
            'campos' => [
                'paciente_id', 'consulta_id', 'veterinario_id', 'producto',
                'tipo', 'via', 'dosis', 'fecha_aplicacion', 'fecha_proxima', 'observaciones',
            ],
            'etiqueta' => 'producto',
        ],
    ];

    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /** @return array{tabla:string,campos:array<int,string>,etiqueta:string} */
    private function config(string $tipo): array
    {
        if (!isset(self::TIPOS[$tipo])) {
            throw new InvalidArgumentException("Tipo de registro sanitario desconocido: $tipo");
        }

        return self::TIPOS[$tipo];
    }

    /** @return array<int,array<string,mixed>> */
    public function listarPorPaciente(string $tipo, int $pacienteId): array
    {
        $cfg = $this->config($tipo);

        $stmt = $this->db->prepare(
            "SELECT s.*, u.nombre AS veterinario_nombre, u.apellido AS veterinario_apellido
             FROM {$cfg['tabla']} s
             INNER JOIN usuarios u ON u.id = s.veterinario_id
             WHERE s.paciente_id = :id
             ORDER BY s.fecha_aplicacion DESC, s.id DESC"
        );
        $stmt->execute(['id' => $pacienteId]);

        return $stmt->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function buscarPorId(string $tipo, int $id): ?array
    {
        $cfg = $this->config($tipo);

        $stmt = $this->db->prepare("SELECT * FROM {$cfg['tabla']} WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    /** @param array<string,mixed> $datos */
    public function crear(string $tipo, array $datos): int
    {
        $cfg   = $this->config($tipo);
        $datos = array_intersect_key($datos, array_flip($cfg['campos']));

        if ($datos === []) {
            throw new InvalidArgumentException('No hay campos validos para insertar.');
        }

        $columnas     = array_keys($datos);
        $placeholders = array_map(static fn (string $c): string => ':' . $c, $columnas);

        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $cfg['tabla'],
            implode(', ', $columnas),
            implode(', ', $placeholders)
        );

        $this->db->prepare($sql)->execute($datos);

        return (int) $this->db->lastInsertId();
    }

    /** @param array<string,mixed> $datos */
    public function actualizar(string $tipo, int $id, array $datos): bool
    {
        $cfg   = $this->config($tipo);
        $datos = array_intersect_key($datos, array_flip($cfg['campos']));

        if ($datos === []) {
            return false;
        }

        $asignaciones = array_map(static fn (string $c): string => "$c = :$c", array_keys($datos));

        $stmt = $this->db->prepare(
            sprintf('UPDATE %s SET %s WHERE id = :id', $cfg['tabla'], implode(', ', $asignaciones))
        );
        $stmt->execute($datos + ['id' => $id]);

        return true;
    }

    public function eliminar(string $tipo, int $id): bool
    {
        $cfg = $this->config($tipo);

        $stmt = $this->db->prepare("DELETE FROM {$cfg['tabla']} WHERE id = :id");
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Vacunas y desparasitaciones proximas a vencer o ya vencidas.
     *
     * Se apoya en la vista v_recordatorios_pendientes del esquema, que es lo
     * que despues alimentara los recordatorios por push.
     *
     * @param int $dias Ventana hacia adelante.
     * @return array<int,array<string,mixed>>
     */
    public function recordatorios(int $dias = 30): array
    {
        // $dias se castea a int e interpola: no viene del usuario sino de un
        // parametro ya validado, y MySQL no acepta parametros dentro de
        // INTERVAL de forma portable.
        $dias = max(1, min($dias, 365));

        $stmt = $this->db->prepare(
            "SELECT r.tipo, r.id, r.detalle, r.fecha_proxima,
                    p.nombre AS paciente, p.id AS paciente_id,
                    c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
                    c.telefono AS cliente_telefono,
                    DATEDIFF(r.fecha_proxima, CURDATE()) AS dias_restantes
             FROM v_recordatorios_pendientes r
             INNER JOIN pacientes p ON p.id = r.paciente_id
             INNER JOIN clientes  c ON c.id = p.cliente_id
             WHERE r.fecha_proxima <= CURDATE() + INTERVAL $dias DAY
               AND c.deleted_at IS NULL
             ORDER BY r.fecha_proxima"
        );
        $stmt->execute();

        return $stmt->fetchAll();
    }
}
