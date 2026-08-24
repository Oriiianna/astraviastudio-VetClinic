<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Clientes (duenos de las mascotas).
 *
 * Este modelo es la PLANTILLA del proyecto: Paciente, Consulta y Turno se
 * escriben con esta misma forma (whitelist de campos, listado paginado con
 * busqueda, baja logica).
 */
final class Cliente extends BaseModel
{
    protected string $tabla = 'clientes';

    protected bool $bajaLogica = true;

    protected array $camposPermitidos = [
        'documento', 'nombre', 'apellido', 'email', 'telefono', 'telefono_alt',
        'direccion', 'ciudad', 'codigo_postal', 'notas', 'activo',
    ];

    protected array $ordenPermitido = ['apellido', 'nombre', 'documento', 'ciudad', 'created_at'];

    /**
     * Listado paginado con busqueda libre.
     *
     * El termino `$q` se compara contra nombre, apellido, documento, telefono
     * y email a la vez: es lo que necesita la recepcionista, que puede tener a
     * mano cualquiera de esos datos. Del lado del frontend la caja de busqueda
     * usa debounce, asi que esta consulta no se dispara por cada tecla.
     *
     * @return array{items: array<int,array<string,mixed>>, total: int}
     */
    public function listar(
        ?string $q = null,
        int $page = 1,
        int $perPage = 20,
        ?string $orderBy = 'apellido',
        ?string $orderDir = 'ASC'
    ): array {
        [$col, $dir]        = $this->ordenSeguro($orderBy, $orderDir);
        [$limit, $offset]   = $this->paginacion($page, $perPage);

        $where  = ['c.deleted_at IS NULL'];
        $params = [];

        if ($q !== null && trim($q) !== '') {
            // Un placeholder DISTINTO por columna, todos con el mismo valor.
            // Con EMULATE_PREPARES=false las sentencias preparadas son reales
            // y MySQL no admite reutilizar un parametro nombrado: repetir :q
            // falla con "Invalid parameter number".
            $columnas = [
                'c.nombre', 'c.apellido', 'c.documento', 'c.telefono', 'c.email',
                "CONCAT(c.nombre, ' ', c.apellido)",
            ];

            $condiciones = [];
            $valor       = '%' . $this->escaparLike(trim($q)) . '%';

            foreach ($columnas as $i => $columna) {
                $condiciones[]    = "$columna LIKE :q$i";
                $params["q$i"]    = $valor;
            }

            $where[] = '(' . implode(' OR ', $condiciones) . ')';
        }

        $sqlWhere = 'WHERE ' . implode(' AND ', $where);

        $stmtCount = $this->db->prepare("SELECT COUNT(*) AS total FROM clientes c $sqlWhere");
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        // Se adjunta la cantidad de mascotas: la recepcionista la mira antes
        // de abrir la ficha, y traerla aqui evita una peticion por fila.
        $sql = "SELECT c.*,
                       (SELECT COUNT(*) FROM pacientes p
                         WHERE p.cliente_id = c.id AND p.deleted_at IS NULL) AS total_pacientes
                FROM clientes c
                $sqlWhere
                ORDER BY c.$col $dir, c.id DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }

    /** Ficha del cliente con sus mascotas activas. */
    public function conPacientes(int $id): ?array
    {
        $cliente = $this->buscarPorId($id);

        if ($cliente === null) {
            return null;
        }

        $stmt = $this->db->prepare(
            'SELECT p.id, p.nombre, p.sexo, p.fecha_nacimiento, p.peso_kg,
                    p.foto_url, p.fallecido, e.nombre AS especie, r.nombre AS raza
             FROM pacientes p
             INNER JOIN especies e ON e.id = p.especie_id
             LEFT  JOIN razas    r ON r.id = p.raza_id
             WHERE p.cliente_id = :id AND p.deleted_at IS NULL
             ORDER BY p.nombre'
        );
        $stmt->execute(['id' => $id]);

        $cliente['pacientes'] = $stmt->fetchAll();

        return $cliente;
    }

    /**
     * @param int|null $exceptoId Para permitir que un cliente conserve su
     *                            documento al editarse a si mismo.
     */
    public function documentoEnUso(string $documento, ?int $exceptoId = null): bool
    {
        $sql    = 'SELECT 1 FROM clientes WHERE documento = :doc';
        $params = ['doc' => $documento];

        if ($exceptoId !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $exceptoId;
        }

        $stmt = $this->db->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);

        return $stmt->fetchColumn() !== false;
    }

    /** Cantidad de mascotas activas: bloquea la baja del cliente si tiene. */
    public function contarPacientes(int $clienteId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM pacientes WHERE cliente_id = :id AND deleted_at IS NULL'
        );
        $stmt->execute(['id' => $clienteId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Neutraliza los comodines de LIKE para que un usuario no convierta
     * "100%" en una busqueda que recorre toda la tabla.
     */
    private function escaparLike(string $valor): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $valor);
    }
}
