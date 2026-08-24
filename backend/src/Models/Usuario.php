<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Usuarios del sistema (staff de la clinica).
 *
 * Ningun metodo publico de esta clase devuelve `password_hash` salvo
 * buscarPorEmailParaLogin(), que es el unico lugar que lo necesita. Asi el
 * hash no se filtra por accidente al serializar una respuesta.
 */
final class Usuario extends BaseModel
{
    protected string $tabla = 'usuarios';

    // `rol` no esta en la whitelist a proposito: cambiar el rol es una
    // operacion privilegiada que pasa por cambiarRol(), no por un update
    // masivo desde un formulario de perfil.
    protected array $camposPermitidos = [
        'nombre', 'apellido', 'email', 'matricula', 'telefono', 'activo',
    ];

    protected array $ordenPermitido = ['apellido', 'nombre', 'email', 'rol', 'created_at'];

    private const CAMPOS_PUBLICOS =
        'id, nombre, apellido, email, rol, matricula, telefono, activo, ultimo_acceso, created_at';

    /**
     * Unico metodo que expone el hash. Se usa solo desde AuthService.
     *
     * @return array<string,mixed>|null
     */
    public function buscarPorEmailParaLogin(string $email): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, nombre, apellido, email, password_hash, rol, activo
             FROM usuarios WHERE email = :email LIMIT 1'
        );
        $stmt->execute(['email' => strtolower($email)]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    /** @return array<string,mixed>|null */
    public function perfil(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT ' . self::CAMPOS_PUBLICOS . ' FROM usuarios WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);

        $fila = $stmt->fetch();

        return $fila === false ? null : $fila;
    }

    /** @return array<int,array<string,mixed>> */
    public function listar(?string $rol = null, bool $soloActivos = true): array
    {
        $where  = [];
        $params = [];

        if ($rol !== null) {
            $where[] = 'rol = :rol';
            $params['rol'] = $rol;
        }

        if ($soloActivos) {
            $where[] = 'activo = 1';
        }

        $sql = 'SELECT ' . self::CAMPOS_PUBLICOS . ' FROM usuarios';

        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $stmt = $this->db->prepare($sql . ' ORDER BY apellido, nombre');
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /** Veterinarios activos: alimenta el selector de la agenda de turnos. */
    public function veterinarios(): array
    {
        return $this->listar('veterinario', true);
    }

    public function emailEnUso(string $email, ?int $exceptoId = null): bool
    {
        $sql    = 'SELECT 1 FROM usuarios WHERE email = :email';
        $params = ['email' => strtolower($email)];

        if ($exceptoId !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $exceptoId;
        }

        $stmt = $this->db->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);

        return $stmt->fetchColumn() !== false;
    }

    public function actualizarPassword(int $id, string $passwordPlano): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE usuarios SET password_hash = :hash WHERE id = :id'
        );

        return $stmt->execute([
            'hash' => password_hash($passwordPlano, PASSWORD_DEFAULT),
            'id'   => $id,
        ]);
    }

    public function registrarAcceso(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    /**
     * Alta con contrasena. El hash se calcula aqui y nunca viaja por
     * `$camposPermitidos`, para que ningun update masivo pueda escribirlo.
     *
     * @param array<string,mixed> $datos Debe incluir `rol`.
     */
    public function crearConPassword(array $datos, string $passwordPlano): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, matricula, telefono)
             VALUES (:nombre, :apellido, :email, :hash, :rol, :matricula, :telefono)'
        );

        $stmt->execute([
            'nombre'    => $datos['nombre'],
            'apellido'  => $datos['apellido'],
            'email'     => strtolower((string) $datos['email']),
            'hash'      => password_hash($passwordPlano, PASSWORD_DEFAULT),
            'rol'       => $datos['rol'],
            'matricula' => $datos['matricula'] ?? null,
            'telefono'  => $datos['telefono'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Cambio de rol.
     *
     * Metodo aparte y no columna en `$camposPermitidos`: elevar privilegios
     * tiene que ser una operacion explicita del codigo, jamas algo que pueda
     * colarse en el body de un formulario de perfil.
     */
    public function cambiarRol(int $id, string $rol): bool
    {
        $stmt = $this->db->prepare('UPDATE usuarios SET rol = :rol WHERE id = :id');

        return $stmt->execute(['rol' => $rol, 'id' => $id]);
    }
}
