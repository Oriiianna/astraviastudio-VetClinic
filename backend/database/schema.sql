-- ============================================================================
--  Clinica Veterinaria - Esquema de base de datos
--  MySQL 8.0+ / MariaDB 10.6+
--
--  Importar:  mysql -u root -p < schema.sql
--             (o desde phpMyAdmin / DBeaver: Importar archivo SQL)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `veterinaria`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `veterinaria`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `adjuntos`;
DROP TABLE IF EXISTS `desparasitaciones`;
DROP TABLE IF EXISTS `vacunas`;
DROP TABLE IF EXISTS `recetas`;
DROP TABLE IF EXISTS `consultas`;
DROP TABLE IF EXISTS `turnos`;
DROP TABLE IF EXISTS `pacientes`;
DROP TABLE IF EXISTS `razas`;
DROP TABLE IF EXISTS `especies`;
DROP TABLE IF EXISTS `clientes`;
DROP TABLE IF EXISTS `intentos_login`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `usuarios`;

SET FOREIGN_KEY_CHECKS = 1;


-- ----------------------------------------------------------------------------
--  1. USUARIOS DEL SISTEMA  (staff de la clinica, no los duenos de mascotas)
-- ----------------------------------------------------------------------------
CREATE TABLE `usuarios` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre`         VARCHAR(80)  NOT NULL,
    `apellido`       VARCHAR(80)  NOT NULL,
    `email`          VARCHAR(150) NOT NULL,
    -- Hash de password_hash() con PASSWORD_DEFAULT. 255 deja margen para
    -- que un futuro cambio de algoritmo (argon2id) no requiera migracion.
    `password_hash`  VARCHAR(255) NOT NULL,
    `rol`            ENUM('admin','veterinario','recepcionista') NOT NULL,
    -- Matricula profesional: obligatoria de hecho para veterinarios, NULL
    -- para el resto de roles. Se valida en la capa de aplicacion.
    `matricula`      VARCHAR(50)      NULL DEFAULT NULL,
    `telefono`       VARCHAR(30)      NULL DEFAULT NULL,
    `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
    `ultimo_acceso`  DATETIME         NULL DEFAULT NULL,
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_usuarios_email` (`email`),
    KEY `idx_usuarios_rol_activo` (`rol`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  2. REFRESH TOKENS  (JWT stateless para el access token, revocable para el refresh)
--     Se guarda solo el hash: si alguien lee la tabla no puede usar los tokens.
-- ----------------------------------------------------------------------------
CREATE TABLE `refresh_tokens` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id`  INT UNSIGNED    NOT NULL,
    `token_hash`  CHAR(64)        NOT NULL COMMENT 'SHA-256 hex del token en claro',
    `user_agent`  VARCHAR(255)        NULL DEFAULT NULL,
    `ip`          VARCHAR(45)         NULL DEFAULT NULL,
    `expires_at`  DATETIME        NOT NULL,
    `revoked_at`  DATETIME            NULL DEFAULT NULL,
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_refresh_hash` (`token_hash`),
    KEY `idx_refresh_usuario` (`usuario_id`, `revoked_at`),
    KEY `idx_refresh_expira` (`expires_at`),
    CONSTRAINT `fk_refresh_usuario` FOREIGN KEY (`usuario_id`)
        REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  3. INTENTOS DE LOGIN  (rate limiting / bloqueo por fuerza bruta)
-- ----------------------------------------------------------------------------
CREATE TABLE `intentos_login` (
    `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email`      VARCHAR(150)    NOT NULL,
    `ip`         VARCHAR(45)     NOT NULL,
    `exitoso`    TINYINT(1)      NOT NULL DEFAULT 0,
    `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_intentos_lookup` (`email`, `ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  4. CLIENTES  (duenos de las mascotas)
--     Baja logica via deleted_at: un cliente puede tener historial clinico
--     asociado que por normativa no se debe destruir.
-- ----------------------------------------------------------------------------
CREATE TABLE `clientes` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `documento`      VARCHAR(30)      NULL DEFAULT NULL COMMENT 'DNI/CUIT/RUT segun pais',
    `nombre`         VARCHAR(80)  NOT NULL,
    `apellido`       VARCHAR(80)  NOT NULL,
    `email`          VARCHAR(150)     NULL DEFAULT NULL,
    `telefono`       VARCHAR(30)  NOT NULL,
    `telefono_alt`   VARCHAR(30)      NULL DEFAULT NULL,
    `direccion`      VARCHAR(200)     NULL DEFAULT NULL,
    `ciudad`         VARCHAR(80)      NULL DEFAULT NULL,
    `codigo_postal`  VARCHAR(20)      NULL DEFAULT NULL,
    `notas`          TEXT             NULL DEFAULT NULL,
    `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME         NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    -- UNIQUE sobre documento: MySQL permite multiples NULL, asi que los
    -- clientes sin documento cargado no colisionan entre si.
    UNIQUE KEY `uq_clientes_documento` (`documento`),
    KEY `idx_clientes_apellido_nombre` (`apellido`, `nombre`),
    KEY `idx_clientes_telefono` (`telefono`),
    KEY `idx_clientes_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  5. CATALOGO: ESPECIES Y RAZAS
-- ----------------------------------------------------------------------------
CREATE TABLE `especies` (
    `id`     SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50)       NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_especies_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `razas` (
    `id`         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `especie_id` SMALLINT UNSIGNED NOT NULL,
    `nombre`     VARCHAR(80)       NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_razas_especie_nombre` (`especie_id`, `nombre`),
    CONSTRAINT `fk_razas_especie` FOREIGN KEY (`especie_id`)
        REFERENCES `especies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  6. PACIENTES  (mascotas)
--     No se guarda la edad: se deriva de fecha_nacimiento. Guardarla
--     garantizaria datos desactualizados desde el dia siguiente.
--     peso_kg aqui es el ULTIMO peso conocido (lectura rapida en fichas);
--     el historico vive en consultas.peso_kg, que es lo que permite graficar
--     la evolucion del animal.
-- ----------------------------------------------------------------------------
CREATE TABLE `pacientes` (
    `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `cliente_id`        INT UNSIGNED  NOT NULL,
    `nombre`            VARCHAR(80)   NOT NULL,
    `especie_id`        SMALLINT UNSIGNED NOT NULL,
    `raza_id`           SMALLINT UNSIGNED NULL DEFAULT NULL,
    `sexo`              ENUM('macho','hembra','desconocido') NOT NULL DEFAULT 'desconocido',
    `fecha_nacimiento`  DATE              NULL DEFAULT NULL,
    `peso_kg`           DECIMAL(6,2)      NULL DEFAULT NULL COMMENT 'Ultimo peso registrado',
    `color`             VARCHAR(60)       NULL DEFAULT NULL,
    `microchip`         VARCHAR(50)       NULL DEFAULT NULL,
    `esterilizado`      TINYINT(1)    NOT NULL DEFAULT 0,
    `alergias`          TEXT              NULL DEFAULT NULL,
    `observaciones`     TEXT              NULL DEFAULT NULL,
    `foto_url`          VARCHAR(255)      NULL DEFAULT NULL,
    `fallecido`         TINYINT(1)    NOT NULL DEFAULT 0,
    `fecha_fallecimiento` DATE            NULL DEFAULT NULL,
    `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `deleted_at`        DATETIME          NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_pacientes_microchip` (`microchip`),
    KEY `idx_pacientes_cliente` (`cliente_id`),
    KEY `idx_pacientes_nombre` (`nombre`),
    KEY `idx_pacientes_deleted` (`deleted_at`),
    -- RESTRICT y no CASCADE: borrar un cliente jamas debe arrastrar
    -- historias clinicas. La baja es logica.
    CONSTRAINT `fk_pacientes_cliente` FOREIGN KEY (`cliente_id`)
        REFERENCES `clientes` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pacientes_especie` FOREIGN KEY (`especie_id`)
        REFERENCES `especies` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_pacientes_raza` FOREIGN KEY (`raza_id`)
        REFERENCES `razas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  7. TURNOS  (agenda de citas)
--     El solapamiento por veterinario se valida en la capa de aplicacion
--     dentro de una transaccion (MySQL no tiene EXCLUDE constraints).
--     El indice compuesto de abajo es el que sostiene esa consulta y la
--     vista de calendario.
-- ----------------------------------------------------------------------------
CREATE TABLE `turnos` (
    `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paciente_id`        INT UNSIGNED NOT NULL,
    `cliente_id`         INT UNSIGNED NOT NULL COMMENT 'Denormalizado: agiliza la agenda sin JOIN extra',
    `veterinario_id`     INT UNSIGNED NOT NULL,
    `fecha_hora_inicio`  DATETIME     NOT NULL,
    `fecha_hora_fin`     DATETIME     NOT NULL,
    `motivo`             VARCHAR(200) NOT NULL,
    `tipo`               ENUM('consulta','vacunacion','cirugia','control','peluqueria','urgencia','otro')
                             NOT NULL DEFAULT 'consulta',
    `estado`             ENUM('programado','confirmado','en_sala','atendido','cancelado','ausente')
                             NOT NULL DEFAULT 'programado',
    `notas`              TEXT             NULL DEFAULT NULL,
    `creado_por`         INT UNSIGNED     NULL DEFAULT NULL,
    `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_turnos_vet_fecha` (`veterinario_id`, `fecha_hora_inicio`),
    KEY `idx_turnos_fecha` (`fecha_hora_inicio`),
    KEY `idx_turnos_paciente` (`paciente_id`),
    KEY `idx_turnos_estado` (`estado`),
    CONSTRAINT `fk_turnos_paciente` FOREIGN KEY (`paciente_id`)
        REFERENCES `pacientes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_turnos_cliente` FOREIGN KEY (`cliente_id`)
        REFERENCES `clientes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_turnos_veterinario` FOREIGN KEY (`veterinario_id`)
        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_turnos_creador` FOREIGN KEY (`creado_por`)
        REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_turnos_rango` CHECK (`fecha_hora_fin` > `fecha_hora_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  8. CONSULTAS  (nucleo del historial clinico)
-- ----------------------------------------------------------------------------
CREATE TABLE `consultas` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paciente_id`     INT UNSIGNED NOT NULL,
    `veterinario_id`  INT UNSIGNED NOT NULL,
    `turno_id`        INT UNSIGNED     NULL DEFAULT NULL COMMENT 'Turno que origino la consulta, si hubo',
    `fecha`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `motivo`          VARCHAR(200) NOT NULL,
    `anamnesis`       TEXT             NULL DEFAULT NULL COMMENT 'Relato del dueno',
    `examen_fisico`   TEXT             NULL DEFAULT NULL,
    `peso_kg`         DECIMAL(6,2)     NULL DEFAULT NULL COMMENT 'Peso en ESTA consulta (historico)',
    `temperatura_c`   DECIMAL(4,1)     NULL DEFAULT NULL,
    `frecuencia_cardiaca`    SMALLINT UNSIGNED NULL DEFAULT NULL,
    `frecuencia_respiratoria` SMALLINT UNSIGNED NULL DEFAULT NULL,
    `diagnostico`     TEXT             NULL DEFAULT NULL,
    `tratamiento`     TEXT             NULL DEFAULT NULL,
    `observaciones`   TEXT             NULL DEFAULT NULL,
    `proximo_control` DATE             NULL DEFAULT NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_consultas_paciente_fecha` (`paciente_id`, `fecha`),
    KEY `idx_consultas_veterinario` (`veterinario_id`),
    CONSTRAINT `fk_consultas_paciente` FOREIGN KEY (`paciente_id`)
        REFERENCES `pacientes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_consultas_veterinario` FOREIGN KEY (`veterinario_id`)
        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_consultas_turno` FOREIGN KEY (`turno_id`)
        REFERENCES `turnos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  9. RECETAS  (medicamentos indicados en una consulta)
-- ----------------------------------------------------------------------------
CREATE TABLE `recetas` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `consulta_id`  INT UNSIGNED NOT NULL,
    `medicamento`  VARCHAR(150) NOT NULL,
    `presentacion` VARCHAR(100)     NULL DEFAULT NULL,
    `dosis`        VARCHAR(100) NOT NULL,
    `frecuencia`   VARCHAR(100) NOT NULL COMMENT 'ej: cada 12 horas',
    `duracion`     VARCHAR(100)     NULL DEFAULT NULL COMMENT 'ej: 7 dias',
    `via`          ENUM('oral','topica','inyectable','oftalmica','otica','otra')
                       NOT NULL DEFAULT 'oral',
    `indicaciones` TEXT             NULL DEFAULT NULL,
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_recetas_consulta` (`consulta_id`),
    -- Una receta no tiene sentido sin su consulta: aqui CASCADE si es correcto.
    CONSTRAINT `fk_recetas_consulta` FOREIGN KEY (`consulta_id`)
        REFERENCES `consultas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 10. VACUNAS
--     consulta_id es NULL-able: una vacuna puede aplicarse sin consulta previa.
--     fecha_proxima alimenta los recordatorios automaticos.
-- ----------------------------------------------------------------------------
CREATE TABLE `vacunas` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paciente_id`      INT UNSIGNED NOT NULL,
    `consulta_id`      INT UNSIGNED     NULL DEFAULT NULL,
    `veterinario_id`   INT UNSIGNED NOT NULL,
    `tipo_vacuna`      VARCHAR(120) NOT NULL COMMENT 'ej: Quintuple, Antirrabica',
    `marca`            VARCHAR(100)     NULL DEFAULT NULL,
    `lote`             VARCHAR(80)      NULL DEFAULT NULL,
    `fecha_aplicacion` DATE         NOT NULL,
    `fecha_proxima`    DATE             NULL DEFAULT NULL,
    `observaciones`    TEXT             NULL DEFAULT NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_vacunas_paciente` (`paciente_id`, `fecha_aplicacion`),
    KEY `idx_vacunas_proxima` (`fecha_proxima`),
    CONSTRAINT `fk_vacunas_paciente` FOREIGN KEY (`paciente_id`)
        REFERENCES `pacientes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_vacunas_consulta` FOREIGN KEY (`consulta_id`)
        REFERENCES `consultas` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_vacunas_veterinario` FOREIGN KEY (`veterinario_id`)
        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 11. DESPARASITACIONES
-- ----------------------------------------------------------------------------
CREATE TABLE `desparasitaciones` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paciente_id`      INT UNSIGNED NOT NULL,
    `consulta_id`      INT UNSIGNED     NULL DEFAULT NULL,
    `veterinario_id`   INT UNSIGNED NOT NULL,
    `producto`         VARCHAR(120) NOT NULL,
    `tipo`             ENUM('interna','externa','mixta') NOT NULL DEFAULT 'interna',
    `via`              ENUM('oral','topica','inyectable') NOT NULL DEFAULT 'oral',
    `dosis`            VARCHAR(100)     NULL DEFAULT NULL,
    `fecha_aplicacion` DATE         NOT NULL,
    `fecha_proxima`    DATE             NULL DEFAULT NULL,
    `observaciones`    TEXT             NULL DEFAULT NULL,
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_despar_paciente` (`paciente_id`, `fecha_aplicacion`),
    KEY `idx_despar_proxima` (`fecha_proxima`),
    CONSTRAINT `fk_despar_paciente` FOREIGN KEY (`paciente_id`)
        REFERENCES `pacientes` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_despar_consulta` FOREIGN KEY (`consulta_id`)
        REFERENCES `consultas` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_despar_veterinario` FOREIGN KEY (`veterinario_id`)
        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 12. ADJUNTOS  (historias clinicas escaneadas, radiografias, estudios, fotos)
--
--     En la BD va SOLO la ruta relativa. El binario vive en backend/storage/,
--     FUERA del document root, y se entrega por GET /api/adjuntos/{id}/archivo,
--     que exige sesion. Servirlos como archivos estaticos desde public/ dejaria
--     la historia clinica de un paciente accesible a cualquiera con la URL.
-- ----------------------------------------------------------------------------
CREATE TABLE `adjuntos` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paciente_id`     INT UNSIGNED NOT NULL,
    `consulta_id`     INT UNSIGNED     NULL DEFAULT NULL,
    `tipo`            ENUM('foto','radiografia','ecografia','analisis','documento','consentimiento','otro')
                          NOT NULL DEFAULT 'documento',
    `ruta`            VARCHAR(255) NOT NULL COMMENT 'Ruta relativa dentro de backend/storage/adjuntos',
    `nombre_original` VARCHAR(255) NOT NULL,
    `mime`            VARCHAR(100) NOT NULL,
    `tamano_bytes`    INT UNSIGNED NOT NULL,
    `descripcion`     VARCHAR(255)     NULL DEFAULT NULL,
    `subido_por`      INT UNSIGNED     NULL DEFAULT NULL,
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_adjuntos_paciente` (`paciente_id`),
    KEY `idx_adjuntos_consulta` (`consulta_id`),
    CONSTRAINT `fk_adjuntos_paciente` FOREIGN KEY (`paciente_id`)
        REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_adjuntos_consulta` FOREIGN KEY (`consulta_id`)
        REFERENCES `consultas` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_adjuntos_usuario` FOREIGN KEY (`subido_por`)
        REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
--  VISTAS de conveniencia
-- ----------------------------------------------------------------------------

-- Ficha de paciente con dueno, especie y raza ya resueltos.
CREATE OR REPLACE VIEW `v_pacientes_completo` AS
SELECT
    p.id,
    p.nombre                                   AS paciente,
    e.nombre                                   AS especie,
    r.nombre                                   AS raza,
    p.sexo,
    p.fecha_nacimiento,
    TIMESTAMPDIFF(MONTH, p.fecha_nacimiento, CURDATE()) AS edad_meses,
    p.peso_kg,
    p.microchip,
    p.foto_url,
    p.fallecido,
    c.id                                       AS cliente_id,
    CONCAT(c.apellido, ', ', c.nombre)         AS dueno,
    c.telefono                                 AS dueno_telefono,
    c.documento                                AS dueno_documento
FROM pacientes p
INNER JOIN clientes c ON c.id = p.cliente_id
INNER JOIN especies e ON e.id = p.especie_id
LEFT  JOIN razas    r ON r.id = p.raza_id
WHERE p.deleted_at IS NULL
  AND c.deleted_at IS NULL;

-- Proximas vacunas y desparasitaciones vencidas o por vencer:
-- alimenta los recordatorios que luego se enviaran por push.
CREATE OR REPLACE VIEW `v_recordatorios_pendientes` AS
SELECT 'vacuna' AS tipo, v.id, v.paciente_id, v.tipo_vacuna AS detalle, v.fecha_proxima
FROM vacunas v
INNER JOIN pacientes p ON p.id = v.paciente_id AND p.deleted_at IS NULL AND p.fallecido = 0
WHERE v.fecha_proxima IS NOT NULL
UNION ALL
SELECT 'desparasitacion', d.id, d.paciente_id, d.producto, d.fecha_proxima
FROM desparasitaciones d
INNER JOIN pacientes p ON p.id = d.paciente_id AND p.deleted_at IS NULL AND p.fallecido = 0
WHERE d.fecha_proxima IS NOT NULL;
