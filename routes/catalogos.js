const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { PATRON_NOMBRE_PERSONA, PATRON_CORREO } = require('../utils/validaciones');

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

router.put('/proveedores/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

    const [existe] = await db.query('SELECT id_proveedor FROM proveedores WHERE id_proveedor = ?', [id]);
    if (!existe.length) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    await db.query(
      'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, direccion = ? WHERE id_proveedor = ?',
      [nombre.trim(), contacto ? contacto.trim() : null, telefono ? telefono.trim() : null, direccion ? direccion.trim() : null, id]
    );

    res.json({ mensaje: 'Proveedor actualizado correctamente.' });
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
    let sql = `SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.estado, u.id_rol, r.nombre AS rol
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

router.put('/usuarios/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, telefono, id_rol, estado } = req.body;

    if (!nombre || !correo || !id_rol || !estado) {
      return res.status(400).json({ error: 'Nombre, correo, rol y estado son obligatorios.' });
    }
    if (!PATRON_NOMBRE_PERSONA.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre solo puede contener letras y espacios.' });
    }
    if (!PATRON_CORREO.test(correo.trim())) {
      return res.status(400).json({ error: 'El correo debe tener un formato válido (ejemplo@dominio.com).' });
    }
    if (telefono && !/^[0-9]{7,15}$/.test(telefono.trim())) {
      return res.status(400).json({ error: 'El teléfono solo puede contener entre 7 y 15 números.' });
    }
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({ error: 'El estado debe ser ACTIVO o INACTIVO.' });
    }

    const [usuarioExiste] = await db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id]);
    if (!usuarioExiste.length) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const [correoExiste] = await db.query(
      'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER(?) AND id_usuario != ?',
      [correo.trim(), id]
    );
    if (correoExiste.length > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado por otro usuario.' });
    }

    const [rolExiste] = await db.query('SELECT id_rol FROM roles WHERE id_rol = ?', [id_rol]);
    if (!rolExiste.length) {
      return res.status(400).json({ error: 'El rol seleccionado no es válido.' });
    }

    if (req.usuario && req.usuario.id_usuario === Number(id) && estado === 'INACTIVO') {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador.' });
    }

    await db.query(
      'UPDATE usuarios SET nombre = ?, correo = ?, telefono = ?, id_rol = ?, estado = ? WHERE id_usuario = ?',
      [nombre.trim(), correo.trim().toLowerCase(), telefono ? telefono.trim() : null, id_rol, estado, id]
    );

    res.json({ mensaje: 'Vendedor/Usuario actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
