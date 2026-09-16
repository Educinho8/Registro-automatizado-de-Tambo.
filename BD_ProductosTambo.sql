CREATE DATABASE IF NOT EXISTS inventario_tambo
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE inventario_tambo;

DROP TABLE IF EXISTS movimientos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(100) NOT NULL,
    rol ENUM('empleado', 'administrador') NOT NULL,
    estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'Gaseosa',
    marca VARCHAR(60) NOT NULL,
    presentacion VARCHAR(40) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 10,
    imagen VARCHAR(255),
    estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (stock >= 0),
    CHECK (stock_minimo >= 0)
);

CREATE TABLE movimientos (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NULL,
    id_usuario INT NOT NULL,
    nombre_producto VARCHAR(120) NOT NULL,
    tipo_movimiento ENUM(
        'entrada',
        'salida',
        'creacion',
        'edicion',
        'eliminacion_logica',
        'eliminacion_fisica'
    ) NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    descripcion VARCHAR(255),
    fecha_movimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),

    CHECK (cantidad >= 0),
    CHECK (stock_anterior >= 0),
    CHECK (stock_nuevo >= 0)
);

INSERT INTO usuarios (nombre, correo, contrasena, rol)
VALUES
('Empleado Tambo', 'empleado@tambo.pe', 'Empleado2026', 'empleado'),
('Administrador Tambo', 'admin@tambo.pe', 'Admin2026', 'administrador');

INSERT INTO productos 
(nombre, categoria, marca, presentacion, stock, stock_minimo, imagen, estado)
VALUES
('Inca Kola Regular 1.5L', 'Gaseosa', 'Inca Kola', '1.5L', 45, 10, 'img/inca_kola.png', 'activo'),
('Coca-Cola Sin Azúcar 1.5L', 'Gaseosa', 'Coca-Cola', '1.5L', 8, 10, 'img/cocacola_zero.png', 'activo'),
('Inca Kola Sin Azúcar 1.5L', 'Gaseosa', 'Inca Kola', '1.5L', 22, 10, 'img/inca_kola_zero.png', 'activo'),
('Coca-Cola Original 500ml', 'Gaseosa', 'Coca-Cola', '500ml', 60, 10, 'img/cocacola.png', 'activo'),
('Fanta Naranja 500ml', 'Gaseosa', 'Fanta', '500ml', 5, 10, 'img/fanta.png', 'activo'),
('Sprite Limón 500ml', 'Gaseosa', 'Sprite', '500ml', 30, 10, 'img/sprite.png', 'activo'),
('Guaraná Backus 500ml', 'Gaseosa', 'Guaraná Backus', '500ml', 0, 10, 'img/guarana.png', 'activo');

-- Mostrar productos activos
SELECT *
FROM productos
WHERE estado = 'activo';

-- Buscar producto por nombre o marca
SELECT *
FROM productos
WHERE estado = 'activo'
AND (
    nombre LIKE '%coca%'
    OR marca LIKE '%coca%'
);

-- Agregar producto nuevo
INSERT INTO productos 
(nombre, categoria, marca, presentacion, stock, stock_minimo, imagen)
VALUES
('Pepsi 500ml', 'Gaseosa', 'Pepsi', '500ml', 20, 10, 'img/pepsi.png');

-- Aumentar stock
UPDATE productos
SET stock = stock + 5
WHERE id_producto = 1
AND estado = 'activo';

-- Disminuir stock
UPDATE productos
SET stock = stock - 3
WHERE id_producto = 1
AND estado = 'activo'
AND stock >= 3;

-- Eliminación lógica: no borra, solo oculta
UPDATE productos
SET estado = 'inactivo'
WHERE id_producto = 7;

-- Eliminación física: borra de la BD
DELETE FROM productos
WHERE id_producto = 11;

select * FROM productos;

UPDATE productos
SET estado = 'activo'
WHERE id_producto = 7;

-- Actualizacion para bases ya creadas antes del modulo de reportes.
-- Ejecutar solo si la tabla movimientos ya existia sin nombre_producto.
-- ALTER TABLE movimientos ADD COLUMN nombre_producto VARCHAR(120) NOT NULL AFTER id_usuario;
-- ALTER TABLE movimientos DROP FOREIGN KEY movimientos_ibfk_1;
-- ALTER TABLE movimientos MODIFY id_producto INT NULL;
-- ALTER TABLE movimientos ADD CONSTRAINT movimientos_ibfk_1
-- FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE SET NULL;
