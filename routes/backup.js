const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Exportar copia de seguridad completa del sistema en formato JSON estructurado
router.get('/', async (req, res) => {
  try {
    const tablas = [
      'categorias',
      'proveedores',
      'clientes',
      'usuarios',
      'productos',
      'compras',
      'detalle_compra',
      'ventas',
      'detalle_venta',
      'movimientos',
      'alertas'
    ];

    const backup = {
      sistema: 'Sistema de Gestión de Inventarios de Cosméticos',
      version: '2.0-PRO',
      fecha_backup: new Date().toISOString(),
      responsable: req.usuario ? `${req.usuario.nombre} (${req.usuario.rol})` : 'Sistema',
      tablas: {}
    };

    for (const tabla of tablas) {
      try {
        const [filas] = await db.query(`SELECT * FROM ${tabla}`);
        backup.tablas[tabla] = filas;
      } catch (errTabla) {
        backup.tablas[tabla] = [];
      }
    }

    const fechaStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="backup_inventario_cosmeticos_${fechaStr}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la copia de seguridad: ' + err.message });
  }
});

module.exports = router;
