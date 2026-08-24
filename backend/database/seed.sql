-- ============================================================================
--  Datos iniciales: catalogo de especies/razas + clientes de demostracion.
--
--  Los USUARIOS no se crean aqui a proposito: un hash de password pegado a
--  mano en un .sql termina copiado a produccion. Se crean con:
--      php bin/crear-usuario.php
-- ============================================================================

USE `veterinaria`;

-- ---------------------------------------------------------------- especies --
INSERT INTO `especies` (`id`, `nombre`) VALUES
    (1, 'Canino'),
    (2, 'Felino'),
    (3, 'Ave'),
    (4, 'Roedor'),
    (5, 'Reptil'),
    (6, 'Conejo'),
    (7, 'Equino'),
    (8, 'Otro')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ------------------------------------------------------------------ razas --
INSERT INTO `razas` (`especie_id`, `nombre`) VALUES
    -- Caninos
    (1, 'Mestizo'), (1, 'Labrador Retriever'), (1, 'Golden Retriever'),
    (1, 'Pastor Aleman'), (1, 'Bulldog Frances'), (1, 'Caniche'),
    (1, 'Chihuahua'), (1, 'Beagle'), (1, 'Boxer'), (1, 'Rottweiler'),
    (1, 'Dachshund'), (1, 'Border Collie'), (1, 'Shih Tzu'),
    (1, 'Yorkshire Terrier'), (1, 'Husky Siberiano'), (1, 'Pug'),
    -- Felinos
    (2, 'Mestizo'), (2, 'Siames'), (2, 'Persa'), (2, 'Maine Coon'),
    (2, 'Angora'), (2, 'Bengali'), (2, 'Sphynx'), (2, 'Ragdoll'),
    (2, 'British Shorthair'),
    -- Aves
    (3, 'Canario'), (3, 'Periquito'), (3, 'Loro'), (3, 'Cacatua'),
    (3, 'Agapornis'), (3, 'Ninfa'),
    -- Roedores
    (4, 'Hamster'), (4, 'Cobayo'), (4, 'Chinchilla'), (4, 'Raton'), (4, 'Jerbo'),
    -- Reptiles
    (5, 'Tortuga'), (5, 'Iguana'), (5, 'Gecko'), (5, 'Serpiente'),
    -- Conejos
    (6, 'Belier'), (6, 'Enano holandes'), (6, 'Cabeza de leon'), (6, 'Rex'),
    -- Equinos / otros
    (7, 'Criollo'), (7, 'Cuarto de milla'),
    (8, 'Sin especificar')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ------------------------------------------------- clientes de demo (dev) --
-- Borrar este bloque antes de pasar a produccion.
INSERT INTO `clientes`
    (`documento`, `nombre`, `apellido`, `email`, `telefono`, `direccion`, `ciudad`)
VALUES
    ('30111222', 'Maria',   'Gomez',    'maria.gomez@example.com',  '351-555-0101', 'Av. Colon 1234',   'Cordoba'),
    ('28999888', 'Juan',    'Perez',    'juan.perez@example.com',   '351-555-0102', 'San Martin 456',   'Cordoba'),
    ('33444555', 'Lucia',   'Fernandez','lucia.f@example.com',      '351-555-0103', 'Belgrano 789',     'Villa Allende'),
    ('27333111', 'Carlos',  'Rodriguez',NULL,                       '351-555-0104', 'Rivadavia 321',    'Cordoba'),
    ('35222444', 'Sofia',   'Martinez', 'sofia.m@example.com',      '351-555-0105', 'Independencia 55', 'Alta Gracia')
ON DUPLICATE KEY UPDATE `telefono` = VALUES(`telefono`);
