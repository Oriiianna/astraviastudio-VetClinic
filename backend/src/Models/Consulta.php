<?php

declare(strict_types=1);

namespace App\Models;

use Throwable;

/**
 * Consultas medicas: el nucleo del historial clinico.
 *
 * Una consulta y sus recetas se guardan SIEMPRE dentro de una transaccion.
 * Media consulta grabada -la cabecera sin las indicaciones- es peor que
 * ninguna: el veterinario cree que quedo registrado el tratamiento y no esta.
 */
final class Consulta extends BaseModel
{
    protected string $tabla = 'consultas';

    protected array $camposPermitidos = [
        'paciente_id', 'veterinario_id', 'turno_id', 'fecha', 'motivo', 'anamnesis',
        'examen_fisico', 'peso_kg', 'temperatura_c', 'frecuencia_cardiaca',
        'frecuencia_respiratoria', 'diagnostico', 'tratamiento', 'observaciones',
        'proximo_control',
    ];

    protected array $ordenPermitido = ['fecha', 'created_at'];

    private const SELECT_BASE = "
        SELECT c.*,
               p.nombre   AS paciente_nombre,
               p.cliente_id,
               e.nombre   AS especie,
               u.nombre   AS veterinario_nombre,
               u.apellido AS veterinario_apellido,
               u.matricula AS veterinario_matricula,
               cl.nombre   AS cliente_nombre,
               cl.apellido AS cliente_apellido
        FROM consultas c
        INNER JOIN pacientes p ON p.id = c.paciente_id
        INNER JOIN especies  e ON e.id = p.especie_id
        INNER JOIN clientes cl ON cl.id = p.cliente_id
        INNER JOIN usuarios  u ON u.id = c.veterinario_id
    ";

    /**
     * @return array{items: array<int,array<string,mixed>>, total: int}
     */
    public function listar(
        ?int $pacienteId = null,
        ?int $veterinarioId = null,
        ?string $desde = null,
        ?string $hasta = null,
        ?string $q = null,
        int $page = 1,
        int $perPage = 20
    ): array {
        [$limit, $offset] = $this->paginacion($page, $perPage);

        $where  = ['p.deleted_at IS NULL'];
        $params = [];

        if ($pacienteId !== null) {
            $where[] = 'c.paciente_id = :paciente_id';
            $params['paciente_id'] = $pacienteId;
        }

        if ($veterinarioId !== null) {
            $where[] = 'c.veterinario_id = :veterinario_id';
            $params['veterinario_id'] = $veterinarioId;
        }

        if ($desde !== null) {
            $where[] = 'c.fecha >= :desde';
            $params['desde'] = $desde . ' 00:00:00';
        }

        if ($hasta !== null) {
            $where[] = 'c.fecha <= :hasta';
            $params['hasta'] = $hasta . ' 23:59:59';
        }

        if ($q !== null && trim($q) !== '') {
            $columnas = ['c.motivo', 'c.diagnostico', 'c.tratamiento', 'p.nombre'];
            $valor    = '%' . $this->escaparLike(trim($q)) . '%';

            $cond = [];
            foreach ($columnas as $i => $columna) {
                $cond[]        = "$columna LIKE :q$i";
                $params["q$i"] = $valor;
            }

            $where[] = '(' . implode(' OR ', $cond) . ')';
        }

        $sqlWhere = 'WHERE ' . implode(' AND ', $where);

        $stmtCount = $this->db->prepare(
            "SELECT COUNT(*) FROM consultas c
             INNER JOIN pacientes p ON p.id = c.paciente_id
             $sqlWhere"
        );
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $stmt = $this->db->prepare(
            self::SELECT_BASE . " $sqlWhere ORDER BY c.fecha DESC, c.id DESC LIMIT $limit OFFSET $offset"
        );
        $stmt->execute($params);

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }

    /** Consulta con sus recetas. @return array<string,mixed>|null */
    public function buscarCompleto(int $id): ?array
    {
        $stmt = $this->db->prepare(self::SELECT_BASE . ' WHERE c.id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        $consulta = $stmt->fetch();

        if ($consulta === false) {
            return null;
        }

        $consulta['recetas'] = $this->recetasDe($id);

        return $consulta;
    }

    /** @return array<int,array<string,mixed>> */
    public function recetasDe(int $consultaId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, medicamento, presentacion, dosis, frecuencia, duracion, via, indicaciones
             FROM recetas WHERE consulta_id = :id ORDER BY id'
        );
        $stmt->execute(['id' => $consultaId]);

        return $stmt->fetchAll();
    }

    /**
     * Crea la consulta con sus recetas y sincroniza el peso de la ficha.
     *
     * Las tres operaciones van juntas o no van: por eso la transaccion.
     *
     * @param array<string,mixed>            $datos
     * @param array<int,array<string,mixed>> $recetas
     */
    public function crearConRecetas(array $datos, array $recetas = []): int
    {
        $this->db->beginTransaction();

        try {
            $id = $this->crear($datos);

            $this->guardarRecetas($id, $recetas);

            // El peso de la consulta es el historico; este es el "ultimo
            // conocido" que se lee en la ficha del paciente.
            if (!empty($datos['peso_kg'])) {
                $stmt = $this->db->prepare(
                    'UPDATE pacientes SET peso_kg = :peso WHERE id = :id'
                );
                $stmt->execute(['peso' => $datos['peso_kg'], 'id' => $datos['paciente_id']]);
            }

            $this->db->commit();

            return $id;
        } catch (Throwable $e) {
            $this->db->rollBack();

            throw $e;
        }
    }

    /**
     * @param array<string,mixed>                 $datos
     * @param array<int,array<string,mixed>>|null $recetas null = no tocar las recetas
     */
    public function actualizarConRecetas(int $id, array $datos, ?array $recetas = null): void
    {
        $this->db->beginTransaction();

        try {
            $this->actualizar($id, $datos);

            if ($recetas !== null) {
                // Reemplazo completo: es lo que espera un formulario donde el
                // veterinario agrega y quita renglones libremente.
                $this->db->prepare('DELETE FROM recetas WHERE consulta_id = :id')
                         ->execute(['id' => $id]);

                $this->guardarRecetas($id, $recetas);
            }

            if (!empty($datos['peso_kg']) && !empty($datos['paciente_id'])) {
                $stmt = $this->db->prepare('UPDATE pacientes SET peso_kg = :peso WHERE id = :id');
                $stmt->execute(['peso' => $datos['peso_kg'], 'id' => $datos['paciente_id']]);
            }

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();

            throw $e;
        }
    }

    /** @param array<int,array<string,mixed>> $recetas */
    private function guardarRecetas(int $consultaId, array $recetas): void
    {
        if ($recetas === []) {
            return;
        }

        $stmt = $this->db->prepare(
            'INSERT INTO recetas
                (consulta_id, medicamento, presentacion, dosis, frecuencia, duracion, via, indicaciones)
             VALUES (:consulta_id, :medicamento, :presentacion, :dosis, :frecuencia, :duracion, :via, :indicaciones)'
        );

        foreach ($recetas as $receta) {
            $stmt->execute([
                'consulta_id'  => $consultaId,
                'medicamento'  => $receta['medicamento'],
                'presentacion' => $receta['presentacion'] ?? null,
                'dosis'        => $receta['dosis'],
                'frecuencia'   => $receta['frecuencia'],
                'duracion'     => $receta['duracion'] ?? null,
                'via'          => $receta['via'] ?? 'oral',
                'indicaciones' => $receta['indicaciones'] ?? null,
            ]);
        }
    }

    private function escaparLike(string $valor): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $valor);
    }
}
