<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Documentos y estudios adjuntos a un paciente.
 *
 * En la base solo va la RUTA relativa; el binario vive en backend/storage/,
 * fuera del document root (ver Support\Almacenamiento).
 */
final class Adjunto extends BaseModel
{
    protected string $tabla = 'adjuntos';

    protected array $camposPermitidos = [
        'paciente_id', 'consulta_id', 'tipo', 'ruta', 'nombre_original',
        'mime', 'tamano_bytes', 'descripcion', 'subido_por',
    ];

    protected array $ordenPermitido = ['created_at', 'nombre_original', 'tamano_bytes'];

    /** @return array<int,array<string,mixed>> */
    public function listarPorPaciente(int $pacienteId): array
    {
        $stmt = $this->db->prepare(
            'SELECT a.id, a.paciente_id, a.consulta_id, a.tipo, a.nombre_original,
                    a.mime, a.tamano_bytes, a.descripcion, a.created_at,
                    u.nombre AS subido_nombre, u.apellido AS subido_apellido
             FROM adjuntos a
             LEFT JOIN usuarios u ON u.id = a.subido_por
             WHERE a.paciente_id = :id
             ORDER BY a.created_at DESC, a.id DESC'
        );
        $stmt->execute(['id' => $pacienteId]);

        return $stmt->fetchAll();
    }

    /**
     * Fila completa CON la ruta en disco. Se usa solo para descargar o borrar;
     * los listados nunca exponen la ruta al cliente.
     *
     * @return array<string,mixed>|null
     */
    public function conRuta(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM adjuntos WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }
}
