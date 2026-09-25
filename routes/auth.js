const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const verificarToken = require('../middleware/auth');
const { revocarToken, requireAdmin } = require('../middleware/auth');
const { PATRON_NOMBRE_PERSONA, PATRON_TELEFONO, PATRON_CORREO } = require('../utils/validaciones');
require('dotenv').config();

const intentosLogin = new Map();
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

function claveIntento(correo) {
  return String(correo || '').trim().toLowerCase();
}

function estadoBloqueo(correo) {
  const clave = claveIntento(correo);
  const registro = intentosLogin.get(clave);
  if (!registro) return { bloqueado: false };
  if (registro.hasta && registro.hasta > Date.now()) {
    const minutos = Math.ceil((registro.hasta - Date.now()) / 60000);
    return { bloqueado: true, minutos };
  }
  if (registro.hasta && registro.hasta <= Date.now()) {
    intentosLogin.delete(clave);
    return { bloqueado: false };
  }
  return { bloqueado: false, fallos: registro.fallos || 0 };
}

function registrarFallo(correo) {
  const clave = claveIntento(correo);
  const actual = intentosLogin.get(clave) || { fallos: 0 };
  actual.fallos = (actual.fallos || 0) + 1;
  if (actual.fallos >= MAX_INTENTOS) {
    actual.hasta = Date.now() + MINUTOS_BLOQUEO * 60 * 1000;
  }
  intentosLogin.set(clave, actual);
}

function limpiarIntentos(correo) {
  intentosLogin.delete(claveIntento(correo));
}

router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;
    const mensajeGenerico = 'Correo o contraseña incorrectos.';

    if (!correo || !password) {
      return res.status(400).json({ error: 'Ingresa tu correo y tu contraseña.' });
    }
    if (!PATRON_CORREO.test(String(correo).trim())) {
      return res.status(400).json({ error: 'El correo debe tener un formato válido (ejemplo@dominio.com).' });
    }

    const bloqueo = estadoBloqueo(correo);
    if (bloqueo.bloqueado) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${bloqueo.minutos} minuto(s).`
      });
    }

    const [rows] = await db.query(
      `SELECT u.*, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE LOWER(u.correo) = LOWER(?)`,
      [correo.trim()]
    );

    if (rows.length === 0) {
      registrarFallo(correo);
      return res.status(401).json({ error: mensajeGenerico });
    }

    const usuario = rows[0];
    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({ error: 'Esta cuenta está inactiva. Contacta al administrador.' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      registrarFallo(correo);
      return res.status(401).json({ error: mensajeGenerico });
    }

    limpiarIntentos(correo);

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, nombre: usuario.nombre, id_rol: usuario.id_rol, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        id_rol: usuario.id_rol,
        rol: usuario.rol
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', verificarToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.id_rol, u.estado, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?`,
      [req.usuario.id_usuario]
    );
    if (!rows.length || rows[0].estado !== 'ACTIVO') {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }
    res.json({ usuario: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', verificarToken, (req, res) => {
  revocarToken(req.token, req.usuario.exp);
  res.json({ mensaje: 'Sesión cerrada correctamente.' });
});

router.post('/recuperar', async (req, res) => {
  const mensaje = 'Si el correo está registrado, un administrador restablecerá tu contraseña desde la pestaña Vendedores.';
  try {
    const { correo } = req.body;
    if (!correo || !PATRON_CORREO.test(String(correo).trim())) {
      return res.json({ mensaje });
    }
    res.json({ mensaje });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', verificarToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, correo, telefono, id_rol, password } = req.body;

    if (!nombre || !correo || !id_rol || !password) {
      return res.status(400).json({ error: 'Complete nombre, correo, rol y contraseña.' });
    }
    if (!PATRON_NOMBRE_PERSONA.test(nombre.trim())) {
      return res.status(400).json({ error: 'El nombre solo puede contener letras y espacios.' });
    }
    if (!PATRON_CORREO.test(correo.trim())) {
      return res.status(400).json({ error: 'El correo debe tener un formato válido (ejemplo@dominio.com).' });
    }
    if (telefono && !PATRON_TELEFONO.test(telefono.trim())) {
      return res.status(400).json({ error: 'El teléfono solo puede contener entre 7 y 10 números.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const [rolRows] = await db.query('SELECT id_rol, nombre FROM roles WHERE id_rol = ?', [id_rol]);
    if (!rolRows.length) {
      return res.status(400).json({ error: 'El rol seleccionado no es válido.' });
    }

    const [existe] = await db.query(
      'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER(?)',
      [correo.trim()]
    );
    if (existe.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, correo, telefono, id_rol, password) VALUES (?, ?, ?, ?, ?)',
      [nombre.trim(), correo.trim().toLowerCase(), telefono ? telefono.trim() : null, id_rol, hash]
    );

    res.status(201).json({ id_usuario: result.insertId, mensaje: 'Usuario registrado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restablecer', verificarToken, requireAdmin, async (req, res) => {
  try {
    const { id_usuario, password } = req.body;
    if (!id_usuario || !password) {
      return res.status(400).json({ error: 'Indica el usuario y la nueva contraseña.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const [existe] = await db.query('SELECT id_usuario FROM usuarios WHERE id_usuario = ?', [id_usuario]);
    if (!existe.length) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [hash, id_usuario]);
    res.json({ mensaje: 'Contraseña restablecida. El usuario ya puede iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
