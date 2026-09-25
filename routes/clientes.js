const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { PATRON_NOMBRE_PERSONA, PATRON_DOCUMENTO, PATRON_TELEFONO, PATRON_CORREO } = require('../utils/validaciones');

function validarContacto(contacto) {
  if (!contacto) return null;
  const valor = contacto.trim();
  if (PATRON_TELEFONO.test(valor) || PATRON_CORREO.test(valor)) return null;
  return 'El contacto debe ser un teléfono de 7 a 10 dígitos o un correo válido.';
}

router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = 'SELECT * FROM clientes';
    let params = [];
    if (buscar) {
      sql += ' WHERE nombre LIKE ? OR documento_identidad LIKE ? OR contacto LIKE ?';
      params = [`%${buscar}%`, `%${buscar}%`, `%${buscar}%`];
    }
    sql += ' ORDER BY nombre ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { documento_identidad, nombre, contacto } = req.body;

    if (!documento_identidad || !nombre) {
      return res.status(400).json({ error: 'El documento de identidad y el nombre son obligatorios.' });
    }
    if (!PATRON_DOCUMENTO.test(documento_identidad.trim())) {
      return res.status(400).json({ error: 'El documento solo debe tener números, entre 8 y 10 dígitos.' });
    }
    if (!PATRON_NOMBRE_PERSONA.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre solo debe tener letras y espacios.' });
    }
    const errorContacto = validarContacto(contacto);
    if (errorContacto) {
      return res.status(400).json({ error: errorContacto });
    }

    const [existe] = await db.query(
      'SELECT id_cliente FROM clientes WHERE documento_identidad = ?',
      [documento_identidad.trim()]
    );
    if (existe.length > 0) {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con ese número de documento.' });
    }

    const [result] = await db.query(
      'INSERT INTO clientes (documento_identidad, nombre, contacto) VALUES (?, ?, ?)',
      [documento_identidad.trim(), nombre.trim(), contacto ? contacto.trim() : null]
    );

    res.status(201).json({
      id_cliente: result.insertId,
      mensaje: 'Cliente registrado correctamente.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, contacto } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!PATRON_NOMBRE_PERSONA.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre solo debe tener letras y espacios.' });
    }
    const errorContacto = validarContacto(contacto);
    if (errorContacto) {
      return res.status(400).json({ error: errorContacto });
    }

    const [existe] = await db.query('SELECT id_cliente FROM clientes WHERE id_cliente = ?', [id]);
    if (existe.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    await db.query(
      'UPDATE clientes SET nombre = ?, contacto = ? WHERE id_cliente = ?',
      [nombre.trim(), contacto ? contacto.trim() : null, id]
    );

    res.json({ mensaje: 'Cliente actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
