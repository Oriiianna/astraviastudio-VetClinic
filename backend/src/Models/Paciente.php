<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Pacientes (mascotas).
 *
 * Escrito calcando Cliente.php: misma whitelist de campos, mismo listado
 * paginado con busqueda y misma baja logica.
 *
 * `edad` NO existe como columna y no se calcula aqui: se deriva en el
 * frontend con calcularEdad() a partir de fecha_nacimiento. Guardarla
 * implicaria un dato desactualizado desde el dia siguiente.
 */
final class Paciente extends BaseModel
{
    protected string $tabla = 'pacientes';

    protected bool $bajaLogica = true;

    protected array $camposPermitidos = [
        'cliente_id', 'nombre', 'especie_id', 'raza_id', 'sexo', 'fecha_nacimiento',
        'peso_kg', 'color', 'microchip', 'esterilizado', 'alergias', 'observaciones',
        'fallecido', 'fecha_fallecimiento',
    ];

    // Solo columnas de `pacientes`: en listar() se prefijan con el alias `p`,
    // asi que aceptar aqui el nombre de una columna de otra tabla romperia
    // la consulta.
    protected array $ordenPermitido = ['nombre', 'fecha_nacimiento', 'peso_kg', 'created_at'];

    /** SELECT compartido por listar() y buscarCompleto(). */
    private const SELECT_BASE = "
        SELECT p.id, p.cliente_id, p.nombre, p.especie_id, p.raza_id, p.sexo,
               p.fecha_nacimiento, p.peso_kg, p.color, p.microchip, p.esterilizado,
               p.alergias, p.observaciones, p.foto_url, p.fallecido,
               p.fecha_fallecimiento, p.created_at, p.updated_at,
               e.nombre  AS especie,
               r.nombre  AS raza,
               c.nombre  AS cliente_nombre,
               c.apellido AS cliente_apellido,
               c.telefono AS cliente_telefono,
               c.documento AS cliente_documento
        FROM pacientes p
        INNER JOIN especies  e ON e.id = p.especie_id
        LEFT  JOIN razas     r ON r.id = p.raza_id
        INNER JOIN clientes  c ON c.id = p.cliente_id
    ";

    /**
     * Listado paginado.
     *
     * La busqueda cubre tambien los datos del DUENO a proposito: en el
     * mostrador es habitual que llamen diciendo "soy Perez, traigo a mi
     * perro" sin recordar como figura cargada la mascota.
     *
     * @return array{items: array<int,array<string,mixed>>, total: int}
     */
    public function listar(
        ?string $q = null,
        ?int $clienteId = null,
        ?int $especieId = null,
        bool $incluirFallecidos = false,
        int $page = 1,
        int $perPage = 20,
        ?string $orderBy = 'nombre',
        ?string $orderDir = 'ASC'
    ): array {
        [$col, $dir]      = $this->ordenSeguro($orderBy, $orderDir);
        [$limit, $offset] = $this->paginacion($page, $perPage);

        // El dueno dado de baja arrastra a sus mascotas fuera del listado:
        // mostrarlas dejaria fichas sin contacto al que responder.
        $where  = ['p.deleted_at IS NULL', 'c.deleted_at IS NULL'];
        $params = [];

        if ($q !== null && trim($q) !== '') {
            // Un placeholder distinto por columna: con EMULATE_PREPARES=false
            // MySQL no admite reutilizar un parametro nombrado.
            $columnas = [
                'p.nombre', 'p.microchip', 'p.color',
                'c.nombre', 'c.apellido', 'c.documento', 'c.telefono',
                "CONCAT(c.nombre, ' ', c.apellido)",
            ];

            $condiciones = [];
            $valor       = '%' . $this->escaparLike(trim($q)) . '%';

            foreach ($columnas as $i => $columna) {
                $condiciones[] = "$columna LIKE :q$i";
                $params["q$i"] = $valor;
            }

            $where[] = '(' . implode(' OR ', $condiciones) . ')';
        }

        if ($clienteId !== null) {
            $where[] = 'p.cliente_id = :cliente_id';
            $params['cliente_id'] = $clienteId;
        }

        if ($especieId !== null) {
            $where[] = 'p.especie_id = :especie_id';
            $params['especie_id'] = $especieId;
        }

        if (!$incluirFallecidos) {
            $where[] = 'p.fallecido = 0';
        }

        $sqlWhere = 'WHERE ' . implode(' AND ', $where);

        $stmtCount = $this->db->prepare(
            "SELECT COUNT(*) FROM pacientes p
             INNER JOIN clientes c ON c.id = p.cliente_id
             $sqlWhere"
        );
        $stmtCount->execute($params);
        $total = (int) $stmtCount->fetchColumn();

        $stmt = $this->db->prepare(
            self::SELECT_BASE . " $sqlWhere ORDER BY p.$col $dir, p.id DESC LIMIT $limit OFFSET $offset"
        );
        $stmt->execute($params);

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }

    /**
     * Ficha completa con especie, raza y dueno resueltos.
     *
     * @return array<string,mixed>|null
     */
    public function buscarCompleto(int $id): ?array
    {
        $stmt = $this->db->prepare(
            self::SELECT_BASE . ' WHERE p.id = :id AND p.deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    /**
     * Historial de pesos para graficar la evolucion del animal.
     *
     * @return array<int,array<string,mixed>>
     */
    public function historialPeso(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT fecha, peso_kg
             FROM consultas
             WHERE paciente_id = :id AND peso_kg IS NOT NULL
             ORDER BY fecha'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetchAll();
    }

    public function microchipEnUso(string $microchip, ?int $exceptoId = null): bool
    {
        $sql    = 'SELECT 1 FROM pacientes WHERE microchip = :chip';
        $params = ['chip' => $microchip];

        if ($exceptoId !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $exceptoId;
        }

        $stmt = $this->db->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * Verifica que la raza pertenezca a la especie indicada.
     *
     * Sin esta comprobacion la FK aceptaria un caniche registrado como felino:
     * ambas claves existen, pero la combinacion no tiene sentido.
     */
    public function razaPerteneceAEspecie(int $razaId, int $especieId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT 1 FROM razas WHERE id = :raza AND especie_id = :especie LIMIT 1'
        );
        $stmt->execute(['raza' => $razaId, 'especie' => $especieId]);

        return $stmt->fetchColumn() !== false;
    }

    /** Cantidad de consultas: bloquea la baja de un paciente con historial. */
    public function contarConsultas(int $pacienteId): int
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM consultas WHERE paciente_id = :id'
        );
        $stmt->execute(['id' => $pacienteId]);

        return (int) $stmt->fetchColumn();
    }

    private function escaparLike(string $valor): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $valor);
    }
}
