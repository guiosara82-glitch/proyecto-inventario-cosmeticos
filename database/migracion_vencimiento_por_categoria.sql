-- Ejecutar una sola vez en inventario_cosmeticos al actualizar una base existente.
USE inventario_cosmeticos;

ALTER TABLE categorias
  ADD COLUMN requiere_vencimiento TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE detalle_compra
  MODIFY COLUMN fecha_vencimiento DATE NULL DEFAULT NULL;
