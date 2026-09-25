const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const { enriquecerCaducidad } = require('../utils/validaciones');

function generarPdfTabla(res, nombreArchivo, titulo, columnas, filas) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  doc.pipe(res);

  doc.fontSize(16).fillColor('#7a4f6b').text(titulo, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555').text(`Generado el ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
  doc.moveDown(1);

  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const anchoColumna = anchoUtil / columnas.length;
  const alturaFila = 20;
  let y = doc.y;

  function dibujarEncabezado() {
    doc.fontSize(9).fillColor('#ffffff');
    doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#b85c8a');
    columnas.forEach((col, i) => {
      doc.fillColor('#ffffff').text(
        col.titulo,
        doc.page.margins.left + i * anchoColumna + 4,
        y + 6,
        { width: anchoColumna - 8 }
      );
    });
    y += alturaFila;
  }

  dibujarEncabezado();

  filas.forEach((fila, indiceFila) => {
    if (y + alturaFila > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      dibujarEncabezado();
    }
    if (indiceFila % 2 === 0) {
      doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#f6e9f0');
    }
    doc.fontSize(8.5).fillColor('#333333');
    columnas.forEach((col, i) => {
      const valorCrudo = fila[col.clave];
      const valor = valorCrudo instanceof Date
        ? valorCrudo.toISOString().slice(0, 16).replace('T', ' ')
        : (valorCrudo === null || valorCrudo === undefined ? '' : String(valorCrudo));
      doc.text(
        valor,
        doc.page.margins.left + i * anchoColumna + 4,
        y + 6,
        { width: anchoColumna - 8 }
      );
    });
    y += alturaFila;
  });

  if (filas.length === 0) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#888').text('No hay registros para este reporte.', { align: 'center' });
  }

  doc.end();
}

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

    const filas = enriquecerCaducidad(rows);

    if (req.query.formato === 'pdf') {
      if (filas.length === 0) {
        return res.status(404).json({ error: 'No hay datos para generar el reporte.' });
      }
      return generarPdfTabla(
        res,
        `reporte_caducidad_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Reporte de Alertas de Caducidad',
        [
          { titulo: 'Producto', clave: 'producto' },
          { titulo: 'SKU', clave: 'sku' },
          { titulo: 'Disponible', clave: 'cantidad_disponible' },
          { titulo: 'Vencimiento', clave: 'fecha_vencimiento' },
          { titulo: 'Días rest.', clave: 'dias_texto' },
          { titulo: 'Estado', clave: 'estado' }
        ],
        filas
      );
    }

    res.json(filas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/movimientos', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Debe indicar fecha de inicio y fecha de fin.' });
    }
    if (new Date(desde) > new Date(hasta)) {
      return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' });
    }

    const hastaFin = hasta + ' 23:59:59';
    const desdeInicio = desde + ' 00:00:00';

    const [rows] = await db.query(
      `
      (SELECT 'ENTRADA' AS tipo, c.fecha_compra AS fecha, p.nombre AS producto,
              dc.cantidad AS cantidad, u.nombre AS usuario, pr.nombre AS detalle
       FROM detalle_compra dc
       JOIN compras c ON dc.id_compra = c.id_compra
       JOIN productos p ON dc.id_producto = p.id_producto
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
       WHERE c.fecha_compra BETWEEN ? AND ?)
      UNION ALL
      (SELECT 'SALIDA' AS tipo, v.fecha_venta AS fecha, p.nombre AS producto,
              dv.cantidad AS cantidad, u.nombre AS usuario, dv.concepto AS detalle
       FROM detalle_venta dv
       JOIN ventas v ON dv.id_venta = v.id_venta
       JOIN productos p ON dv.id_producto = p.id_producto
       JOIN usuarios u ON v.id_usuario = u.id_usuario
       WHERE v.fecha_venta BETWEEN ? AND ?)
      ORDER BY fecha ASC
      `,
      [desdeInicio, hastaFin, desdeInicio, hastaFin]
    );

    if (req.query.formato === 'pdf') {
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No se encontraron movimientos en este periodo.' });
      }
      return generarPdfTabla(
        res,
        `reporte_movimientos_${desde}_a_${hasta}.pdf`,
        `Reporte de Entradas y Salidas (${desde} a ${hasta})`,
        [
          { titulo: 'Tipo', clave: 'tipo' },
          { titulo: 'Fecha', clave: 'fecha' },
          { titulo: 'Producto', clave: 'producto' },
          { titulo: 'Cantidad', clave: 'cantidad' },
          { titulo: 'Usuario', clave: 'usuario' },
          { titulo: 'Detalle', clave: 'detalle' }
        ],
        rows
      );
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron movimientos en este periodo.' });
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

