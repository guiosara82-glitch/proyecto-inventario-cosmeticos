const express = require('express');
const router = express.Router();
const db = require('../config/db');

const PATRON_TEXTO = /^[A-Za-z\u00C0-\u00FF0-9\s.'-]{2,150}$/;
const PATRON_TELEFONO = /^[0-9]{7,15}$/;

router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categorias', async (req, res) => {
  try {
    const { nombre, requiere_vencimiento = true } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    if (!PATRON_TEXTO.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre de la categoría contiene caracteres no permitidos.' });
    }
    const [existe] = await db.query('SELECT id_categoria FROM categorias WHERE nombre = ?', [nombre.trim()]);
    if (existe.length > 0) {
      return res.status(409).json({ error: 'Esa categoría ya existe.' });
    }
    const [result] = await db.query(
      'INSERT INTO categorias (nombre, requiere_vencimiento) VALUES (?, ?)',
      [nombre.trim(), requiere_vencimiento === false || requiere_vencimiento === 0 ? 0 : 1]
    );
    res.status(201).json({ id_categoria: result.insertId, mensaje: 'Categoría registrada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proveedores', async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = 'SELECT * FROM proveedores';
    let params = [];
    if (buscar) {
      sql += ' WHERE nombre LIKE ? OR contacto LIKE ? OR telefono LIKE ?';
      params = [`%${buscar}%`, `%${buscar}%`, `%${buscar}%`];
    }
    sql += ' ORDER BY nombre ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/proveedores', async (req, res) => {
  try {
    const { nombre, contacto, telefono, direccion } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
    }
    if (!PATRON_TEXTO.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre del proveedor contiene caracteres no permitidos.' });
    }
    if (telefono && !/^[0-9\-\s\+]{7,20}$/.test(telefono.trim())) {
      return res.status(400).json({ error: 'El teléfono debe contener entre 7 y 20 números.' });
    }
    const [result] = await db.query(
      'INSERT INTO proveedores (nombre, contacto, telefono, direccion) VALUES (?, ?, ?, ?)',
      [nombre.trim(), contacto ? contacto.trim() : null, telefono ? telefono.trim() : null, direccion ? direccion.trim() : null]
    );
    res.status(201).json({ id_proveedor: result.insertId, mensaje: 'Proveedor registrado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/roles', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM roles ORDER BY id_rol');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/usuarios', async (req, res) => {
  try {
    const { solo_activos } = req.query;
    let sql = `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.id_rol, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol`;
    const params = [];
    if (solo_activos === '1' || solo_activos === 'true') {
      sql += ` WHERE u.estado = 'ACTIVO'`;
    }
    sql += ` ORDER BY u.nombre`;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
