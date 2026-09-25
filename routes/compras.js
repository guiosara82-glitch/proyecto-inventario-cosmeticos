const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT dc.id_detalle_compra, p.sku, p.nombre AS producto, dc.cantidad,
             dc.cantidad_disponible, dc.costo_unitario, dc.fecha_vencimiento,
             c.fecha_compra, pr.nombre AS proveedor
      FROM detalle_compra dc
      JOIN compras c ON dc.id_compra = c.id_compra
      JOIN productos p ON dc.id_producto = p.id_producto
      JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      ORDER BY c.fecha_compra DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id_proveedor, items } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!id_proveedor || !id_usuario) {
      return res.status(400).json({ error: 'Proveedor y usuario son obligatorios.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la compra.' });
    }

    for (const item of items) {
      const { id_producto, cantidad, costo_unitario, fecha_vencimiento } = item;
      if (!id_producto || !cantidad || cantidad <= 0) {
        return res.status(400).json({ error: 'Cada producto debe tener una cantidad válida mayor a cero.' });
      }
      if (!costo_unitario || costo_unitario <= 0) {
        return res.status(400).json({ error: 'El costo unitario debe ser mayor a cero.' });
      }
      if (!fecha_vencimiento) {
        return res.status(400).json({ error: 'La fecha de vencimiento es obligatoria para cada lote.' });
      }
      if (new Date(fecha_vencimiento) <= new Date()) {
        return res.status(400).json({ error: 'La fecha de vencimiento debe ser posterior a hoy.' });
      }

      const [[producto]] = await conn.query(
        'SELECT nombre, precio, estado FROM productos WHERE id_producto = ?',
        [id_producto]
      );
      if (!producto) {
        return res.status(404).json({ error: `Producto con id ${id_producto} no encontrado.` });
      }
      if (producto.estado === 'INACTIVO') {
        return res.status(400).json({ error: `El producto "${producto.nombre}" está inactivo y no recibe entradas.` });
      }
      if (parseFloat(costo_unitario) >= parseFloat(producto.precio)) {
        return res.status(400).json({
          error: `El costo de compra ($${Number(costo_unitario).toFixed(2)}) para "${producto.nombre}" no puede ser mayor o igual a su precio de venta establecido ($${Number(producto.precio).toFixed(2)}). Debe existir margen de ganancia.`
        });
      }
    }

    await conn.beginTransaction();

    const total = items.reduce((acc, it) => acc + it.cantidad * it.costo_unitario, 0);
    const [compraResult] = await conn.query(
      'INSERT INTO compras (id_proveedor, id_usuario, total) VALUES (?, ?, ?)',
      [id_proveedor, id_usuario, total]
    );
    const id_compra = compraResult.insertId;

    for (const item of items) {
      const { id_producto, cantidad, costo_unitario, fecha_vencimiento } = item;
      await conn.query(
        'INSERT INTO detalle_compra (id_compra, id_producto, cantidad, cantidad_disponible, costo_unitario, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)',
        [id_compra, id_producto, cantidad, cantidad, costo_unitario, fecha_vencimiento]
      );
      await conn.query(
        'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
        [cantidad, id_producto]
      );
    }

    await conn.commit();
    res.status(201).json({ id_compra, mensaje: 'Entrada registrada correctamente.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
