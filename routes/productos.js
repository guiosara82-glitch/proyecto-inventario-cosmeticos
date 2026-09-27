const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { PATRON_SKU, PATRON_PRODUCTO, esVacio, validarPrecio } = require('../utils/validaciones');

router.get('/', async (req, res) => {
  try {
    const { buscar, solo_activos } = req.query;
    let sql = `SELECT p.*, c.nombre AS categoria,
              c.requiere_vencimiento,
              (SELECT dc.costo_unitario 
               FROM detalle_compra dc 
               WHERE dc.id_producto = p.id_producto 
               ORDER BY dc.id_detalle_compra DESC LIMIT 1) AS ultimo_costo
               FROM productos p 
               JOIN categorias c ON p.id_categoria = c.id_categoria
               WHERE 1=1`;
    let params = [];
    if (solo_activos === '1') {
      sql += " AND p.estado = 'ACTIVO'";
    }
    if (buscar) {
      sql += ' AND (p.nombre LIKE ? OR p.marca LIKE ? OR p.sku LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    sql += ' ORDER BY p.nombre';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock-critico', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY stock_actual ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sku, nombre, marca, precio, id_categoria, stock_minimo } = req.body;

    if (esVacio(sku) || esVacio(nombre) || esVacio(id_categoria) || precio === undefined || precio === null || precio === '') {
      return res.status(400).json({ error: 'Complete todos los campos obligatorios (SKU, nombre, precio, categoría).' });
    }
    if (!PATRON_SKU.test(String(sku).trim())) {
      return res.status(400).json({ error: 'El SKU debe tener formato de código (letras + guion + números), por ejemplo MAQ-001.' });
    }
    if (!PATRON_PRODUCTO.test(String(nombre).trim())) {
      return res.status(400).json({ error: 'El nombre debe contener letras (no solo números o signos).' });
    }
    if (marca && String(marca).trim() !== '' && !PATRON_PRODUCTO.test(String(marca).trim())) {
      return res.status(400).json({ error: 'La marca debe contener letras (no solo números o signos).' });
    }
    const errorPrecio = validarPrecio(precio);
    if (errorPrecio) {
      return res.status(400).json({ error: errorPrecio });
    }
    if (stock_minimo !== undefined && (isNaN(stock_minimo) || Number(stock_minimo) < 0)) {
      return res.status(400).json({ error: 'El stock mínimo no puede ser negativo.' });
    }

    const [existe] = await db.query('SELECT id_producto FROM productos WHERE sku = ?', [sku.trim()]);
    if (existe.length > 0) {
      return res.status(409).json({ error: 'El código SKU ya existe.' });
    }

    const [result] = await db.query(
      'INSERT INTO productos (sku, nombre, marca, precio, id_categoria, stock_minimo, stock_actual) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [sku.trim().toUpperCase(), nombre.trim(), marca ? marca.trim() : null, precio, id_categoria, stock_minimo || 0]
    );
    res.status(201).json({ id_producto: result.insertId, mensaje: 'Producto registrado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marca, precio, id_categoria, stock_minimo, estado } = req.body;

    if (esVacio(nombre) || esVacio(id_categoria) || precio === undefined || precio === null || precio === '') {
      return res.status(400).json({ error: 'Complete los campos obligatorios (nombre, precio, categoría).' });
    }
    if (!PATRON_PRODUCTO.test(String(nombre).trim())) {
      return res.status(400).json({ error: 'El nombre debe contener letras (no solo números o signos).' });
    }
    if (marca && String(marca).trim() !== '' && !PATRON_PRODUCTO.test(String(marca).trim())) {
      return res.status(400).json({ error: 'La marca debe contener letras (no solo números o signos).' });
    }
    const errorPrecio = validarPrecio(precio);
    if (errorPrecio) {
      return res.status(400).json({ error: errorPrecio });
    }
    if (stock_minimo !== undefined && (isNaN(stock_minimo) || Number(stock_minimo) < 0)) {
      return res.status(400).json({ error: 'El stock mínimo no puede ser negativo.' });
    }

    const [existe] = await db.query('SELECT id_producto FROM productos WHERE id_producto = ?', [id]);
    if (existe.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const [costoRows] = await db.query(
      'SELECT MAX(costo_unitario) as costo_max FROM detalle_compra WHERE id_producto = ? AND cantidad_disponible > 0',
      [id]
    );
    const costoMax = costoRows[0]?.costo_max;
    if (costoMax && parseFloat(precio) <= parseFloat(costoMax)) {
      return res.status(400).json({
        error: `El precio ($${Number(precio).toFixed(2)}) no puede ser menor o igual al costo de adquisición de los lotes activos ($${Number(costoMax).toFixed(2)}). Debe haber ganancia.`
      });
    }

    const estadoFinal = estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';

    await db.query(
      'UPDATE productos SET nombre = ?, marca = ?, precio = ?, id_categoria = ?, stock_minimo = ?, estado = ? WHERE id_producto = ?',
      [nombre.trim(), marca ? marca.trim() : null, precio, id_categoria, stock_minimo || 0, estadoFinal, id]
    );

    res.json({ mensaje: 'Producto actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
