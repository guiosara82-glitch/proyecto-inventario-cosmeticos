const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { enriquecerCaducidad } = require('../utils/validaciones');

router.get('/caducidad', async (req, res) => {
  try {
    const { dias = 30, buscar, id_producto } = req.query;
    let sql = `SELECT dc.id_detalle_compra, p.nombre AS producto, p.sku, dc.cantidad_disponible,
              dc.fecha_vencimiento,
              DATEDIFF(dc.fecha_vencimiento, CURDATE()) AS dias_restantes,
              CASE
                WHEN dc.fecha_vencimiento < CURDATE() THEN 'VENCIDO'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 30 THEN 'URGENTE'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 60 THEN 'PROXIMO (2 meses)'
                ELSE 'PROXIMO'
              END AS estado
       FROM detalle_compra dc
       JOIN productos p ON dc.id_producto = p.id_producto
       WHERE dc.cantidad_disponible > 0
         AND dc.fecha_vencimiento IS NOT NULL`;
    
    const params = [];
    if (dias && dias !== 'todos') {
      sql += ' AND DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= ?';
      params.push(parseInt(dias));
    }
    if (id_producto) {
      sql += ' AND dc.id_producto = ?';
      params.push(id_producto);
    }
    if (buscar) {
      sql += ' AND (p.nombre LIKE ? OR p.sku LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`);
    }

    sql += ' ORDER BY dc.fecha_vencimiento ASC';

    const [rows] = await db.query(sql, params);
    res.json(enriquecerCaducidad(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
