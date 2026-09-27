-- Sistema de inventario de productos cosméticos
-- MySQL 8.0+
-- Crea la base, las tablas y datos de prueba.

CREATE DATABASE IF NOT EXISTS inventario_cosmeticos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE inventario_cosmeticos;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS alertas;
DROP TABLE IF EXISTS detalle_venta;
DROP TABLE IF EXISTS detalle_compra;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS compras;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  id_rol INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  correo VARCHAR(150) NOT NULL,
  telefono VARCHAR(30) DEFAULT NULL,
  id_rol INT NOT NULL,
  credencial_temporal VARCHAR(255) DEFAULT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id_usuario),
  UNIQUE KEY correo (correo),
  KEY id_rol (id_rol),
  CONSTRAINT usuarios_ibfk_1 FOREIGN KEY (id_rol) REFERENCES roles (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categorias (
  id_categoria INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  requiere_vencimiento TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE proveedores (
  id_proveedor INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  contacto VARCHAR(150) DEFAULT NULL,
  telefono VARCHAR(30) DEFAULT NULL,
  direccion VARCHAR(200) DEFAULT NULL,
  PRIMARY KEY (id_proveedor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE productos (
  id_producto INT NOT NULL AUTO_INCREMENT,
  sku VARCHAR(50) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  marca VARCHAR(100) DEFAULT NULL,
  precio DECIMAL(10,2) NOT NULL,
  id_categoria INT NOT NULL,
  stock_minimo INT NOT NULL DEFAULT 0,
  stock_actual INT NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  UNIQUE KEY sku (sku),
  KEY id_categoria (id_categoria),
  KEY idx_productos_stock (stock_actual, stock_minimo),
  CONSTRAINT productos_ibfk_1 FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE clientes (
  id_cliente INT NOT NULL AUTO_INCREMENT,
  documento_identidad VARCHAR(30) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  contacto VARCHAR(150) DEFAULT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  UNIQUE KEY documento_identidad (documento_identidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE compras (
  id_compra INT NOT NULL AUTO_INCREMENT,
  id_proveedor INT NOT NULL,
  id_usuario INT NOT NULL,
  fecha_compra DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id_compra),
  KEY id_proveedor (id_proveedor),
  KEY id_usuario (id_usuario),
  KEY idx_compras_fecha (fecha_compra),
  CONSTRAINT compras_ibfk_1 FOREIGN KEY (id_proveedor) REFERENCES proveedores (id_proveedor),
  CONSTRAINT compras_ibfk_2 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE detalle_compra (
  id_detalle_compra INT NOT NULL AUTO_INCREMENT,
  id_compra INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  cantidad_disponible INT NOT NULL,
  costo_unitario DECIMAL(10,2) NOT NULL,
  fecha_vencimiento DATE DEFAULT NULL,
  PRIMARY KEY (id_detalle_compra),
  KEY id_compra (id_compra),
  KEY idx_detalle_compra_producto (id_producto),
  KEY idx_detalle_compra_vencimiento (fecha_vencimiento),
  CONSTRAINT detalle_compra_ibfk_1 FOREIGN KEY (id_compra) REFERENCES compras (id_compra),
  CONSTRAINT detalle_compra_ibfk_2 FOREIGN KEY (id_producto) REFERENCES productos (id_producto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ventas (
  id_venta INT NOT NULL AUTO_INCREMENT,
  id_cliente INT DEFAULT NULL,
  id_usuario INT NOT NULL,
  fecha_venta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id_venta),
  KEY id_cliente (id_cliente),
  KEY id_usuario (id_usuario),
  KEY idx_ventas_fecha (fecha_venta),
  CONSTRAINT ventas_ibfk_1 FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente),
  CONSTRAINT ventas_ibfk_2 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE detalle_venta (
  id_detalle_venta INT NOT NULL AUTO_INCREMENT,
  id_venta INT NOT NULL,
  id_producto INT NOT NULL,
  id_detalle_compra INT DEFAULT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  concepto VARCHAR(20) NOT NULL DEFAULT 'VENTA',
  PRIMARY KEY (id_detalle_venta),
  KEY id_venta (id_venta),
  KEY id_detalle_compra (id_detalle_compra),
  KEY idx_detalle_venta_producto (id_producto),
  CONSTRAINT detalle_venta_ibfk_1 FOREIGN KEY (id_venta) REFERENCES ventas (id_venta),
  CONSTRAINT detalle_venta_ibfk_2 FOREIGN KEY (id_producto) REFERENCES productos (id_producto),
  CONSTRAINT detalle_venta_ibfk_3 FOREIGN KEY (id_detalle_compra) REFERENCES detalle_compra (id_detalle_compra),
  CONSTRAINT detalle_venta_chk_1 CHECK ((concepto IN ('VENTA','MUESTRA','DAÑADO')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE alertas (
  id_alerta INT NOT NULL AUTO_INCREMENT,
  id_producto INT NOT NULL,
  id_detalle_compra INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  mensaje VARCHAR(255) NOT NULL,
  fecha_generada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
  PRIMARY KEY (id_alerta),
  KEY id_producto (id_producto),
  KEY id_detalle_compra (id_detalle_compra),
  KEY idx_alertas_estado (estado, tipo),
  CONSTRAINT alertas_ibfk_1 FOREIGN KEY (id_producto) REFERENCES productos (id_producto),
  CONSTRAINT alertas_ibfk_2 FOREIGN KEY (id_detalle_compra) REFERENCES detalle_compra (id_detalle_compra),
  CONSTRAINT alertas_chk_1 CHECK ((tipo IN ('CADUCIDAD','STOCK_CRITICO')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Contraseña de todos los usuarios de prueba: Prueba123
INSERT INTO roles (id_rol, nombre) VALUES
  (1, 'Administrador'),
  (2, 'Vendedor');

INSERT INTO usuarios (id_usuario, nombre, correo, telefono, id_rol, estado, password) VALUES
  (1, 'Admin Prueba', 'admin@correo.com', '3001112233', 1, 'ACTIVO', '$2b$10$R7gGG9zdXoYUOOGtPqH34uwH.dR/J2IRFK9hLKoBEtsez44717FeO'),
  (2, 'Vendedora Prueba', 'vendedor@correo.com', '3002223344', 2, 'ACTIVO', '$2b$10$R7gGG9zdXoYUOOGtPqH34uwH.dR/J2IRFK9hLKoBEtsez44717FeO'),
  (3, 'Usuario Inactivo', 'inactivo@correo.com', '3003334455', 2, 'INACTIVO', '$2b$10$R7gGG9zdXoYUOOGtPqH34uwH.dR/J2IRFK9hLKoBEtsez44717FeO');

INSERT INTO categorias (id_categoria, nombre) VALUES
  (1, 'Skincare'),
  (2, 'Maquillaje'),
  (3, 'Cabello'),
  (4, 'Perfumería');

INSERT INTO proveedores (id_proveedor, nombre, contacto, telefono, direccion) VALUES
  (1, 'Cosméticos del Valle', 'Laura Pérez', '3105556677', 'Cali, Valle del Cauca'),
  (2, 'Belleza Andina SAS', 'Carlos Ruiz', '3158889900', 'Bogotá');

INSERT INTO productos (id_producto, sku, nombre, marca, precio, id_categoria, stock_minimo, stock_actual, estado) VALUES
  (1, 'MAQ-001', 'Base liquida', 'Sheglam', 45000.00, 2, 10, 20, 'ACTIVO'),
  (2, 'MAQ-002', 'Rimel volumen', 'Prosa', 18000.00, 2, 15, 8, 'ACTIVO'),
  (3, 'PER-001', 'Locion floral', 'Yanbal', 85000.00, 4, 5, 12, 'ACTIVO'),
  (4, 'SKI-001', 'Crema de arroz', 'Aqua', 32000.00, 1, 5, 25, 'ACTIVO'),
  (5, 'CAB-001', 'Shampoo reparador', 'Loreal', 28000.00, 3, 8, 18, 'ACTIVO');

INSERT INTO clientes (id_cliente, documento_identidad, nombre, contacto) VALUES
  (1, '1023627989', 'Sara Gomez', '3128769790'),
  (2, '120931283', 'Luisa Martinez', '381238331');

INSERT INTO compras (id_compra, id_proveedor, id_usuario, fecha_compra, total) VALUES
  (1, 1, 1, DATE_SUB(NOW(), INTERVAL 20 DAY), 500000.00),
  (2, 1, 2, DATE_SUB(NOW(), INTERVAL 10 DAY), 96000.00),
  (3, 2, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), 720000.00),
  (4, 1, 2, DATE_SUB(NOW(), INTERVAL 2 DAY), 400000.00),
  (5, 1, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), 360000.00);

INSERT INTO detalle_compra (id_detalle_compra, id_compra, id_producto, cantidad, cantidad_disponible, costo_unitario, fecha_vencimiento) VALUES
  (1, 1, 1, 25, 20, 20000.00, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
  (2, 2, 2, 12, 8, 8000.00, DATE_ADD(CURDATE(), INTERVAL 12 DAY)),
  (3, 3, 3, 15, 12, 48000.00, DATE_ADD(CURDATE(), INTERVAL 400 DAY)),
  (4, 4, 4, 25, 25, 16000.00, DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (5, 5, 5, 18, 18, 14000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY));

INSERT INTO ventas (id_venta, id_cliente, id_usuario, fecha_venta, total) VALUES
  (1, 1, 2, DATE_SUB(NOW(), INTERVAL 8 DAY), 45000.00),
  (2, NULL, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), 72000.00),
  (3, 2, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 255000.00);

INSERT INTO detalle_venta (id_detalle_venta, id_venta, id_producto, id_detalle_compra, cantidad, precio_unitario, concepto) VALUES
  (1, 1, 1, 1, 1, 45000.00, 'VENTA'),
  (2, 2, 2, 2, 4, 18000.00, 'VENTA'),
  (3, 3, 3, 3, 3, 85000.00, 'VENTA');
