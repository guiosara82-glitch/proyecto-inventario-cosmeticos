const jwt = require('jsonwebtoken');
require('dotenv').config();

const tokensRevocados = new Map();

function limpiaRevocados() {
  const ahora = Date.now();
  for (const [token, expira] of tokensRevocados.entries()) {
    if (expira <= ahora) tokensRevocados.delete(token);
  }
}

function revocarToken(token, expSegundos) {
  const expira = expSegundos ? expSegundos * 1000 : Date.now() + 8 * 60 * 60 * 1000;
  tokensRevocados.set(token, expira);
  limpiaRevocados();
}

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Sesión no iniciada. Inicia sesión para continuar.' });
  }

  limpiaRevocados();
  if (tokensRevocados.has(token)) {
    return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión de nuevo.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) {
      return res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión de nuevo.' });
    }
    req.usuario = usuario;
    req.token = token;
    next();
  });
}

function requireAdmin(req, res, next) {
  const rol = (req.usuario && req.usuario.rol) || '';
  if (rol !== 'Administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede realizar esta acción.' });
  }
  next();
}

module.exports = verificarToken;
module.exports.verificarToken = verificarToken;
module.exports.revocarToken = revocarToken;
module.exports.requireAdmin = requireAdmin;
