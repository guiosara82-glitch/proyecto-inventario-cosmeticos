const express = require('express');
const cors = require('cors');
require('dotenv').config();

const verificarToken = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const catalogosRoutes = require('./routes/catalogos');
const comprasRoutes = require('./routes/compras');
const ventasRoutes = require('./routes/ventas');
const alertasRoutes = require('./routes/alertas');
const reportesRoutes = require('./routes/reportes');
const clientesRoutes = require('./routes/clientes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/productos', verificarToken, productosRoutes);
app.use('/api/catalogos', verificarToken, catalogosRoutes);
app.use('/api/compras', verificarToken, comprasRoutes);
app.use('/api/ventas', verificarToken, ventasRoutes);
app.use('/api/alertas', verificarToken, alertasRoutes);
app.use('/api/reportes', verificarToken, reportesRoutes);
app.use('/api/clientes', verificarToken, clientesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;


