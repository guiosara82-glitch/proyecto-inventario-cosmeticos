const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT v.id_venta, v.fecha_venta, v.total, dv.cantidad, dv.precio_unitario,
             dv.concepto, p.nombre AS producto, u.nombre AS usuario,
             COALESCE(c.nombre, 'Cliente General') AS cliente
      FROM ventas v
      JOIN detalle_venta dv ON v.id_venta = dv.id_venta
      JOIN productos p ON dv.id_producto = p.id_producto
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
      ORDER BY v.fecha_venta DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id_cliente, items } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!id_usuario) {
      return res.status(400).json({ error: 'El usuario es obligatorio.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la salida.' });
    }

    await conn.beginTransaction();

    for (const item of items) {
      const { id_producto, cantidad, precio_unitario, concepto } = item;
      const tipoConcepto = concepto || 'VENTA';
      if (!id_producto || !cantidad || cantidad <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Cada producto debe tener una cantidad válida mayor a cero.' });
      }

      if (tipoConcepto === 'VENTA') {
        const precio = parseFloat(precio_unitario);
        if (isNaN(precio) || precio <= 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'El precio unitario de venta debe ser un número mayor a cero.' });
        }
      }

      const [[producto]] = await conn.query(
        `SELECT p.stock_actual, p.stock_minimo, p.nombre, p.estado, c.requiere_vencimiento
         FROM productos p JOIN categorias c ON p.id_categoria = c.id_categoria
         WHERE p.id_producto = ? FOR UPDATE`,
        [id_producto]
      );
      if (!producto) {
        await conn.rollback();
        return res.status(404).json({ error: `Producto con id ${id_producto} no encontrado.` });
      }
      if (producto.estado === 'INACTIVO') {
        await conn.rollback();
        return res.status(400).json({ error: `El producto "${producto.nombre}" está inactivo y no se puede vender.` });
      }

      const filtroVencimiento = Number(producto.requiere_vencimiento) === 1
        ? 'AND fecha_vencimiento >= CURDATE()'
        : '';
      const [[stockVigente]] = await conn.query(
        `SELECT COALESCE(SUM(cantidad_disponible), 0) AS disponible
         FROM detalle_compra
         WHERE id_producto = ? AND cantidad_disponible > 0 ${filtroVencimiento}`,
        [id_producto]
      );
      const disponibleVigente = Number(stockVigente.disponible);
      if (disponibleVigente < cantidad) {
        await conn.rollback();
        return res.status(409).json({
          error: `Stock insuficiente o vencido para "${producto.nombre}". Disponible vigente: ${disponibleVigente}.`
        });
      }

      if (tipoConcepto === 'VENTA') {
        const [lotes] = await conn.query(
          `SELECT id_detalle_compra, cantidad_disponible, costo_unitario
           FROM detalle_compra
           WHERE id_producto = ? AND cantidad_disponible > 0 ${filtroVencimiento}
           ORDER BY fecha_vencimiento IS NULL ASC, fecha_vencimiento ASC`,
          [id_producto]
        );
        let restanteCheck = cantidad;
        for (const lote of lotes) {
          if (restanteCheck <= 0) break;
          if (parseFloat(precio_unitario) <= parseFloat(lote.costo_unitario)) {
            await conn.rollback();
            return res.status(400).json({
              error: `El precio de venta ($${Number(precio_unitario).toFixed(2)}) para "${producto.nombre}" debe ser mayor que el costo del lote adquirido ($${Number(lote.costo_unitario).toFixed(2)}) para generar ganancia.`
            });
          }
          restanteCheck -= Math.min(lote.cantidad_disponible, restanteCheck);
        }
      }
    }

    const total = items.reduce((acc, it) => acc + it.cantidad * (it.precio_unitario || 0), 0);
    const [ventaResult] = await conn.query(
      'INSERT INTO ventas (id_cliente, id_usuario, total) VALUES (?, ?, ?)',
      [id_cliente || null, id_usuario, total]
    );
    const id_venta = ventaResult.insertId;

    for (const item of items) {
      let { id_producto, cantidad, precio_unitario, concepto } = item;
      concepto = concepto || 'VENTA';
      let restante = cantidad;

      const [lotes] = await conn.query(
        `SELECT id_detalle_compra, cantidad_disponible
         FROM detalle_compra
         WHERE id_producto = ? AND cantidad_disponible > 0
           AND (EXISTS (
             SELECT 1 FROM productos p JOIN categorias c ON p.id_categoria = c.id_categoria
             WHERE p.id_producto = detalle_compra.id_producto AND c.requiere_vencimiento = 0
           ) OR fecha_vencimiento >= CURDATE())
         ORDER BY fecha_vencimiento IS NULL ASC, fecha_vencimiento ASC`,
        [id_producto]
      );

      for (const lote of lotes) {
        if (restante <= 0) break;
        const tomar = Math.min(lote.cantidad_disponible, restante);
        await conn.query(
          'UPDATE detalle_compra SET cantidad_disponible = cantidad_disponible - ? WHERE id_detalle_compra = ?',
          [tomar, lote.id_detalle_compra]
        );
        await conn.query(
          'INSERT INTO detalle_venta (id_venta, id_producto, id_detalle_compra, cantidad, precio_unitario, concepto) VALUES (?, ?, ?, ?, ?, ?)',
          [id_venta, id_producto, lote.id_detalle_compra, tomar, precio_unitario || 0, concepto]
        );
        restante -= tomar;
      }

      if (restante > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'No hay lotes vigentes suficientes para completar la salida.' });
      }

      await conn.query(
        'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
        [cantidad, id_producto]
      );
    }

    await conn.commit();
    res.status(201).json({ id_venta, mensaje: 'Salida registrada correctamente.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Comprobante de venta (tirilla / recibo comercial - Contexto Colombiano)
router.get('/:id/comprobante', async (req, res) => {
  try {
    const idVenta = req.params.id;
    const [[venta]] = await db.query(
      `SELECT v.id_venta, v.fecha_venta, v.total,
              u.nombre AS vendedor, u.correo AS vendedor_correo,
              COALESCE(c.nombre, 'Cliente General') AS cliente_nombre,
              COALESCE(c.documento_identidad, '222222222222') AS cliente_documento,
              COALESCE(c.contacto, 'N/A') AS cliente_telefono
       FROM ventas v
       JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       WHERE v.id_venta = ?`,
      [idVenta]
    );

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    const [items] = await db.query(
      `SELECT dv.id_detalle_venta, p.sku, p.nombre AS producto, dv.cantidad,
              dv.precio_unitario, (dv.cantidad * dv.precio_unitario) AS subtotal,
              dv.concepto, dv.id_detalle_compra AS id_lote
       FROM detalle_venta dv
       JOIN productos p ON dv.id_producto = p.id_producto
       WHERE dv.id_venta = ?`,
      [idVenta]
    );

    if (req.query.formato === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30, size: [280, 500] });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo_venta_${idVenta}.pdf"`);
      doc.pipe(res);

      doc.fontSize(12).fillColor('#7a4f6b').text('TIENDA DE COSMÉTICOS', { align: 'center' });
      doc.fontSize(8).fillColor('#444').text('NIT: 901.458.789-1', { align: 'center' });
      doc.text('Régimen Simplificado / Facturación Pos', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#222').text(`COMPROBANTE DE VENTA N° ${idVenta}`, { align: 'center' });
      doc.fontSize(8).text(`Fecha: ${new Date(venta.fecha_venta).toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown(0.5);

      doc.text('----------------------------------------------------', { align: 'center' });
      doc.fontSize(8).text(`Cliente: ${venta.cliente_nombre}`);
      doc.text(`Doc / Cédula: ${venta.cliente_documento}`);
      doc.text(`Vendedor: ${venta.vendedor}`);
      doc.text('----------------------------------------------------', { align: 'center' });
      doc.moveDown(0.3);

      items.forEach(it => {
        doc.fontSize(8).fillColor('#000').text(`${it.producto} (x${it.cantidad})`, { bold: true });
        doc.fillColor('#555').text(`  SKU: ${it.sku} | Unit: $${Number(it.precio_unitario).toLocaleString('es-CO')} -> $${Number(it.subtotal).toLocaleString('es-CO')}`);
      });

      doc.moveDown(0.5);
      doc.text('----------------------------------------------------', { align: 'center' });
      doc.fontSize(10).fillColor('#7a4f6b').text(`TOTAL A PAGAR: $${Number(venta.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })} COP`, { align: 'right' });
      doc.moveDown(0.8);

      doc.fontSize(7).fillColor('#777').text('¡Gracias por su compra!', { align: 'center' });
      doc.text('Conserve este comprobante para cualquier garantía.', { align: 'center' });
      doc.end();
      return;
    }

    res.json({
      venta,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
