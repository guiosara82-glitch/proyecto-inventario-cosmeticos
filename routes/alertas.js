const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enriquecerCaducidad } = require('../utils/validaciones');

router.get('/caducidad', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const [rows] = await db.query(
      `SELECT dc.id_detalle_compra, p.nombre AS producto, p.sku, dc.cantidad_disponible,
              dc.fecha_vencimiento,
              DATEDIFF(dc.fecha_vencimiento, CURDATE()) AS dias_restantes,
              CASE
                WHEN dc.fecha_vencimiento < CURDATE() THEN 'VENCIDO'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 30 THEN 'URGENTE'
                ELSE 'PROXIMO'
              END AS estado
       FROM detalle_compra dc
       JOIN productos p ON dc.id_producto = p.id_producto
       WHERE dc.cantidad_disponible > 0
         AND DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= ?
       ORDER BY dc.fecha_vencimiento ASC`,
      [dias]
    );
    res.json(enriquecerCaducidad(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
