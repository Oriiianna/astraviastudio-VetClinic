<?php

declare(strict_types=1);

namespace App\Models;

use PDO;

/**
 * Catalogo de especies y razas.
 *
 * No extiende BaseModel: no tiene CRUD ni baja logica, son solo lecturas de
 * tablas de referencia.
 */
final class Catalogo
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Especies con sus razas anidadas.
     *
     * Va todo en una sola respuesta a proposito: el catalogo completo son
     * ~50 filas y cambia muy de vez en cuando, asi que el formulario lo pide
     * una vez y filtra las razas en memoria al elegir especie. La alternativa
     * -pedir /razas?especie_id= en cada cambio del select- suma latencia
     * visible por nada.
     *
     * @return array<int,array<string,mixed>>
     */
    public function especiesConRazas(): array
    {
        $especies = $this->db
            ->query('SELECT id, nombre FROM especies ORDER BY nombre')
            ->fetchAll();

        $razas = $this->db
            ->query('SELECT id, especie_id, nombre FROM razas ORDER BY nombre')
            ->fetchAll();

        $porEspecie = [];
        foreach ($razas as $raza) {
            $porEspecie[(int) $raza['especie_id']][] = [
                'id'     => (int) $raza['id'],
                'nombre' => $raza['nombre'],
            ];
        }

        return array_map(
            static fn (array $e): array => [
                'id'     => (int) $e['id'],
                'nombre' => $e['nombre'],
                'razas'  => $porEspecie[(int) $e['id']] ?? [],
            ],
            $especies
        );
    }

    public function especieExiste(int $id): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM especies WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);

        return $stmt->fetchColumn() !== false;
    }
}
