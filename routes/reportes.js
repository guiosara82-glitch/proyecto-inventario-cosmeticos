const express = require('express');
const router = express.Router();
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const { enriquecerCaducidad } = require('../utils/validaciones');

// Función utilitaria para generar tablas en PDF con diseño profesional
function generarPdfTabla(res, nombreArchivo, titulo, subtitulo, columnas, filas, totales = null) {
  const doc = new PDFDocument({ margin: 35, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  doc.pipe(res);

  // Encabezado institucional
  doc.fontSize(16).fillColor('#7a4f6b').text('SISTEMA DE GESTIÓN DE INVENTARIOS DE COSMÉTICOS', { align: 'center' });
  doc.fontSize(13).fillColor('#333333').text(titulo, { align: 'center' });
  if (subtitulo) {
    doc.fontSize(9).fillColor('#666666').text(subtitulo, { align: 'center' });
  }
  doc.fontSize(8).fillColor('#888888').text(`Fecha de emisión: ${new Date().toLocaleString('es-CO')} | Moneda: COP ($)`, { align: 'center' });
  doc.moveDown(0.8);

  const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const anchoColumna = anchoUtil / columnas.length;
  const alturaFila = 20;
  let y = doc.y;

  function dibujarEncabezado() {
    doc.fontSize(8.5).fillColor('#ffffff');
    doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#7a4f6b');
    columnas.forEach((col, i) => {
      doc.fillColor('#ffffff').text(
        col.titulo,
        doc.page.margins.left + i * anchoColumna + 4,
        y + 5,
        { width: anchoColumna - 8, align: col.align || 'left' }
      );
    });
    y += alturaFila;
  }

  dibujarEncabezado();

  filas.forEach((fila, indiceFila) => {
    if (y + alturaFila > doc.page.height - doc.page.margins.bottom - (totales ? 30 : 15)) {
      doc.addPage();
      y = doc.page.margins.top;
      dibujarEncabezado();
    }
    if (indiceFila % 2 === 0) {
      doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#fbf5f8');
    }
    doc.fontSize(8).fillColor('#222222');
    columnas.forEach((col, i) => {
      let valor = fila[col.clave];
      if (valor instanceof Date) {
        valor = valor.toISOString().slice(0, 10);
      } else if (valor === null || valor === undefined) {
        valor = '-';
      } else if (col.esMoneda) {
        valor = '$' + Number(valor).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        valor = String(valor);
      }

      doc.text(
        valor,
        doc.page.margins.left + i * anchoColumna + 4,
        y + 6,
        { width: anchoColumna - 8, align: col.align || 'left' }
      );
    });
    y += alturaFila;
  });

  if (totales && typeof totales === 'object') {
    y += 5;
    doc.rect(doc.page.margins.left, y, anchoUtil, alturaFila).fill('#eedbe6');
    doc.fontSize(8.5).fillColor('#7a4f6b');
    let textoTotales = 'TOTALES: ';
    Object.keys(totales).forEach(k => {
      textoTotales += ` | ${k}: ${totales[k]}`;
    });
    doc.text(textoTotales, doc.page.margins.left + 8, y + 5, { width: anchoUtil - 16, align: 'right' });
  }

  if (filas.length === 0) {
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor('#888888').text('No se encontraron registros para los filtros seleccionados.', { align: 'center' });
  }

  doc.end();
}

// ========================================================
// 1. REPORTE GENERAL: RESUMEN DE INDICADORES (KPIs)
// ========================================================
router.get('/resumen-general', async (req, res) => {
  try {
    const [[inv]] = await db.query(`
      SELECT 
        COUNT(*) AS total_productos,
        COALESCE(SUM(stock_actual), 0) AS total_unidades_stock,
        COALESCE(SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END), 0) AS productos_agotados,
        COALESCE(SUM(CASE WHEN stock_actual > 0 AND stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS productos_criticos,
        COALESCE(SUM(CASE WHEN stock_actual > stock_minimo THEN 1 ELSE 0 END), 0) AS productos_normales
      FROM productos
      WHERE estado = 'ACTIVO'
    `);

    const [[val]] = await db.query(`
      SELECT COALESCE(SUM(cantidad_disponible * costo_unitario), 0) AS valor_inventario_costo
      FROM detalle_compra
      WHERE cantidad_disponible > 0
    `);

    const [[ventas]] = await db.query(`
      SELECT 
        COUNT(*) AS total_ventas,
        COALESCE(SUM(total), 0) AS total_recaudado,
        COALESCE(AVG(total), 0) AS ticket_promedio
      FROM ventas
    `);

    const [[artsVendidos]] = await db.query(`
      SELECT COALESCE(SUM(cantidad), 0) AS unidades_vendidas
      FROM detalle_venta
      WHERE concepto = 'VENTA'
    `);

    const [[alertas]] = await db.query(`
      SELECT 
        COUNT(*) AS total_alertas_caducidad
      FROM detalle_compra
      WHERE cantidad_disponible > 0 
        AND fecha_vencimiento IS NOT NULL
        AND DATEDIFF(fecha_vencimiento, CURDATE()) <= 30
    `);

    res.json({
      inventario: {
        total_productos: Number(inv.total_productos),
        total_unidades: Number(inv.total_unidades_stock),
        valor_costo_cop: Number(val.valor_inventario_costo),
        productos_agotados: Number(inv.productos_agotados),
        productos_criticos: Number(inv.productos_criticos),
        productos_normales: Number(inv.productos_normales)
      },
      ventas: {
        total_ventas: Number(ventas.total_ventas),
        total_recaudado_cop: Number(ventas.total_recaudado),
        ticket_promedio_cop: Number(ventas.ticket_promedio),
        unidades_vendidas: Number(artsVendidos.unidades_vendidas)
      },
      alertas: {
        caducidad_proxima: Number(alertas.total_alertas_caducidad)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 2. REPORTE GENERAL: INVENTARIO GENERAL VALORIZADO
// ========================================================
router.get('/inventario-general', async (req, res) => {
  try {
    const { id_categoria, estado_stock, formato } = req.query;

    let sql = `
      SELECT 
        p.id_producto,
        p.sku,
        p.nombre,
        p.marca,
        c.nombre AS categoria,
        p.stock_actual,
        p.stock_minimo,
        p.precio AS precio_venta,
        COALESCE(
          (SELECT dc.costo_unitario 
           FROM detalle_compra dc 
           WHERE dc.id_producto = p.id_producto AND dc.cantidad_disponible > 0
           ORDER BY dc.fecha_vencimiento IS NULL ASC, dc.fecha_vencimiento ASC, dc.id_detalle_compra ASC 
           LIMIT 1),
          (SELECT dc.costo_unitario 
           FROM detalle_compra dc 
           WHERE dc.id_producto = p.id_producto 
           ORDER BY dc.id_detalle_compra ASC 
           LIMIT 1),
          0
        ) AS costo_unitario_fifo,
        (p.stock_actual * COALESCE(
          (SELECT dc.costo_unitario 
           FROM detalle_compra dc 
           WHERE dc.id_producto = p.id_producto AND dc.cantidad_disponible > 0
           ORDER BY dc.fecha_vencimiento IS NULL ASC, dc.fecha_vencimiento ASC, dc.id_detalle_compra ASC 
           LIMIT 1),
          (SELECT dc.costo_unitario 
           FROM detalle_compra dc 
           WHERE dc.id_producto = p.id_producto 
           ORDER BY dc.id_detalle_compra ASC 
           LIMIT 1),
          0
        )) AS valor_total_costo,
        CASE
          WHEN p.stock_actual = 0 THEN 'AGOTADO'
          WHEN p.stock_actual <= p.stock_minimo THEN 'CRITICO'
          ELSE 'NORMAL'
        END AS estado_stock
      FROM productos p
      JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'ACTIVO'
    `;

    const params = [];
    if (id_categoria) {
      sql += ' AND p.id_categoria = ?';
      params.push(id_categoria);
    }
    if (estado_stock && estado_stock !== 'TODOS') {
      if (estado_stock === 'AGOTADO') sql += ' AND p.stock_actual = 0';
      else if (estado_stock === 'CRITICO') sql += ' AND p.stock_actual > 0 AND p.stock_actual <= p.stock_minimo';
      else if (estado_stock === 'NORMAL') sql += ' AND p.stock_actual > p.stock_minimo';
    }

    sql += ' ORDER BY c.nombre, p.nombre';
    const [rows] = await db.query(sql, params);

    const totalStock = rows.reduce((acc, r) => acc + Number(r.stock_actual), 0);
    const totalValor = rows.reduce((acc, r) => acc + Number(r.valor_total_costo), 0);

    if (formato === 'pdf') {
      return generarPdfTabla(
        res,
        `inventario_general_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Reporte General de Inventario Valorizado (Método FIFO/PEPS)',
        'Valuación del inventario a costo de adquisición del lote FIFO vigente',
        [
          { titulo: 'SKU', clave: 'sku', align: 'left' },
          { titulo: 'Producto', clave: 'nombre', align: 'left' },
          { titulo: 'Categoría', clave: 'categoria', align: 'left' },
          { titulo: 'Stock', clave: 'stock_actual', align: 'center' },
          { titulo: 'Mínimo', clave: 'stock_minimo', align: 'center' },
          { titulo: 'Costo FIFO', clave: 'costo_unitario_fifo', esMoneda: true, align: 'right' },
          { titulo: 'P. Venta', clave: 'precio_venta', esMoneda: true, align: 'right' },
          { titulo: 'Valor Total', clave: 'valor_total_costo', esMoneda: true, align: 'right' },
          { titulo: 'Estado', clave: 'estado_stock', align: 'center' }
        ],
        rows,
        {
          'Total Unidades': totalStock,
          'Valorización Total (COP)': '$' + totalValor.toLocaleString('es-CO', { minimumFractionDigits: 2 })
        }
      );
    }

    res.json({
      resumen: {
        total_items: rows.length,
        total_unidades: totalStock,
        valor_total_inventario: totalValor
      },
      productos: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 3. REPORTE ESPECÍFICO: KARDEX POR PRODUCTO (PEPS/FIFO)
// ========================================================
router.get('/kardex-producto', async (req, res) => {
  try {
    const { id_producto, desde, hasta, formato } = req.query;
    if (!id_producto) {
      return res.status(400).json({ error: 'Debe especificar el id_producto para generar su Kardex.' });
    }

    const [[producto]] = await db.query(
      `SELECT p.id_producto, p.sku, p.nombre, p.marca, p.stock_actual, p.stock_minimo, p.precio, c.nombre AS categoria
       FROM productos p JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE p.id_producto = ?`,
      [id_producto]
    );

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    let sql = `
      (SELECT 
        'ENTRADA' AS tipo_movimiento,
        c.fecha_compra AS fecha,
        CONCAT('Compra #', c.id_compra, ' (Lote #', dc.id_detalle_compra, ')') AS referencia,
        pr.nombre AS tercero,
        dc.cantidad AS cantidad,
        dc.costo_unitario AS valor_unitario,
        (dc.cantidad * dc.costo_unitario) AS valor_total,
        u.nombre AS responsable
       FROM detalle_compra dc
       JOIN compras c ON dc.id_compra = c.id_compra
       JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE dc.id_producto = ?
      )
      UNION ALL
      (SELECT 
        CONCAT('SALIDA (', dv.concepto, ')') AS tipo_movimiento,
        v.fecha_venta AS fecha,
        CONCAT('Venta #', v.id_venta, ' (Desc. Lote #', dv.id_detalle_compra, ')') AS referencia,
        COALESCE(cl.nombre, 'Cliente General') AS tercero,
        -dv.cantidad AS cantidad,
        dv.precio_unitario AS valor_unitario,
        (dv.cantidad * dv.precio_unitario) AS valor_total,
        u.nombre AS responsable
       FROM detalle_venta dv
       JOIN ventas v ON dv.id_venta = v.id_venta
       JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes cl ON v.id_cliente = cl.id_cliente
       WHERE dv.id_producto = ?
      )
    `;

    const params = [id_producto, id_producto];

    if (desde && hasta) {
      sql = `SELECT * FROM (${sql}) AS m WHERE m.fecha BETWEEN ? AND ? ORDER BY m.fecha ASC`;
      params.push(desde + ' 00:00:00', hasta + ' 23:59:59');
    } else {
      sql = `SELECT * FROM (${sql}) AS m ORDER BY m.fecha ASC`;
    }

    const [movs] = await db.query(sql, params);

    // Calcular saldos acumulados paso a paso (Kardex físico)
    let saldoAcumulado = 0;
    const kardexFilas = movs.map(m => {
      saldoAcumulado += Number(m.cantidad);
      return {
        ...m,
        cantidad_mov: Math.abs(Number(m.cantidad)),
        saldo_unidades: saldoAcumulado
      };
    });

    if (formato === 'pdf') {
      return generarPdfTabla(
        res,
        `kardex_${producto.sku}_${new Date().toISOString().slice(0, 10)}.pdf`,
        `Kardex de Movimientos: ${producto.nombre} (${producto.sku})`,
        `Categoría: ${producto.categoria} | Marca: ${producto.marca || '-'} | Stock en Sistema: ${producto.stock_actual} un.`,
        [
          { titulo: 'Fecha', clave: 'fecha', align: 'left' },
          { titulo: 'Tipo', clave: 'tipo_movimiento', align: 'center' },
          { titulo: 'Referencia', clave: 'referencia', align: 'left' },
          { titulo: 'Tercero', clave: 'tercero', align: 'left' },
          { titulo: 'Cantidad', clave: 'cantidad_mov', align: 'center' },
          { titulo: 'V. Unitario', clave: 'valor_unitario', esMoneda: true, align: 'right' },
          { titulo: 'Saldo Un.', clave: 'saldo_unidades', align: 'center' },
          { titulo: 'Responsable', clave: 'responsable', align: 'left' }
        ],
        kardexFilas,
        {
          'Saldo Final en Kardex': saldoAcumulado + ' unidades',
          'Precio Venta Sugerido': '$' + Number(producto.precio).toLocaleString('es-CO')
        }
      );
    }

    res.json({
      producto,
      saldo_final: saldoAcumulado,
      movimientos: kardexFilas
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 4. REPORTE ESPECÍFICO: VENTAS POR CLIENTE
// ========================================================
router.get('/ventas-cliente', async (req, res) => {
  try {
    const { id_cliente, desde, hasta, formato } = req.query;

    let sql = `
      SELECT 
        v.id_venta,
        v.fecha_venta,
        COALESCE(c.nombre, 'Cliente General') AS cliente,
        COALESCE(c.documento_identidad, 'Sin documento') AS documento,
        u.nombre AS vendedor,
        v.total,
        GROUP_CONCAT(CONCAT(p.nombre, ' (x', dv.cantidad, ')') SEPARATOR ', ') AS detalle_productos
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      JOIN detalle_venta dv ON v.id_venta = dv.id_venta
      JOIN productos p ON dv.id_producto = p.id_producto
      WHERE 1=1
    `;

    const params = [];
    if (id_cliente) {
      sql += ' AND v.id_cliente = ?';
      params.push(id_cliente);
    }
    if (desde && hasta) {
      sql += ' AND v.fecha_venta BETWEEN ? AND ?';
      params.push(desde + ' 00:00:00', hasta + ' 23:59:59');
    }

    sql += ' GROUP BY v.id_venta, v.fecha_venta, c.nombre, c.documento_identidad, u.nombre, v.total ORDER BY v.fecha_venta DESC';

    const [rows] = await db.query(sql, params);
    const totalRecaudado = rows.reduce((acc, r) => acc + Number(r.total), 0);

    let nombreClienteFiltro = 'Todos los clientes';
    if (id_cliente && rows.length > 0) {
      nombreClienteFiltro = `${rows[0].cliente} (Doc: ${rows[0].documento})`;
    }

    if (formato === 'pdf') {
      return generarPdfTabla(
        res,
        `ventas_cliente_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Reporte de Ventas por Cliente',
        `Cliente: ${nombreClienteFiltro}`,
        [
          { titulo: 'Venta #', clave: 'id_venta', align: 'center' },
          { titulo: 'Fecha', clave: 'fecha_venta', align: 'left' },
          { titulo: 'Cliente', clave: 'cliente', align: 'left' },
          { titulo: 'Documento', clave: 'documento', align: 'center' },
          { titulo: 'Vendedor', clave: 'vendedor', align: 'left' },
          { titulo: 'Productos', clave: 'detalle_productos', align: 'left' },
          { titulo: 'Total COP', clave: 'total', esMoneda: true, align: 'right' }
        ],
        rows,
        {
          'Total Compras del Cliente': '$' + totalRecaudado.toLocaleString('es-CO', { minimumFractionDigits: 2 }),
          'N° Transacciones': rows.length
        }
      );
    }

    res.json({
      total_ventas: rows.length,
      total_recaudado: totalRecaudado,
      ventas: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 5. REPORTE ESPECÍFICO: COMPRAS POR PROVEEDOR
// ========================================================
router.get('/compras-proveedor', async (req, res) => {
  try {
    const { id_proveedor, desde, hasta, formato } = req.query;

    let sql = `
      SELECT 
        c.id_compra,
        c.fecha_compra,
        pr.nombre AS proveedor,
        pr.contacto,
        pr.telefono,
        u.nombre AS responsable,
        c.total,
        GROUP_CONCAT(CONCAT(p.nombre, ' (x', dc.cantidad, ' a $', dc.costo_unitario, ')') SEPARATOR ', ') AS detalle_lotes
      FROM compras c
      JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      JOIN detalle_compra dc ON c.id_compra = dc.id_compra
      JOIN productos p ON dc.id_producto = p.id_producto
      WHERE 1=1
    `;

    const params = [];
    if (id_proveedor) {
      sql += ' AND c.id_proveedor = ?';
      params.push(id_proveedor);
    }
    if (desde && hasta) {
      sql += ' AND c.fecha_compra BETWEEN ? AND ?';
      params.push(desde + ' 00:00:00', hasta + ' 23:59:59');
    }

    sql += ' GROUP BY c.id_compra, c.fecha_compra, pr.nombre, pr.contacto, pr.telefono, u.nombre, c.total ORDER BY c.fecha_compra DESC';

    const [rows] = await db.query(sql, params);
    const totalInvertido = rows.reduce((acc, r) => acc + Number(r.total), 0);

    let nombreProveedor = 'Todos los proveedores';
    if (id_proveedor && rows.length > 0) {
      nombreProveedor = `${rows[0].proveedor} (Contacto: ${rows[0].contacto || '-'})`;
    }

    if (formato === 'pdf') {
      return generarPdfTabla(
        res,
        `compras_proveedor_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Reporte de Abastecimiento por Proveedor',
        `Proveedor: ${nombreProveedor}`,
        [
          { titulo: 'Compra #', clave: 'id_compra', align: 'center' },
          { titulo: 'Fecha', clave: 'fecha_compra', align: 'left' },
          { titulo: 'Proveedor', clave: 'proveedor', align: 'left' },
          { titulo: 'Teléfono', clave: 'telefono', align: 'center' },
          { titulo: 'Responsable', clave: 'responsable', align: 'left' },
          { titulo: 'Lotes Ingresados', clave: 'detalle_lotes', align: 'left' },
          { titulo: 'Inversión COP', clave: 'total', esMoneda: true, align: 'right' }
        ],
        rows,
        {
          'Total Invertido': '$' + totalInvertido.toLocaleString('es-CO', { minimumFractionDigits: 2 }),
          'N° Órdenes de Compra': rows.length
        }
      );
    }

    res.json({
      total_compras: rows.length,
      total_invertido: totalInvertido,
      compras: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 6. ALERTAS DE CADUCIDAD
// ========================================================
router.get('/caducidad', async (req, res) => {
  try {
    const { dias = 60, buscar, id_producto, formato } = req.query;
    let sql = `SELECT dc.id_detalle_compra, p.nombre AS producto, p.sku, dc.cantidad_disponible,
              dc.fecha_vencimiento,
              DATEDIFF(dc.fecha_vencimiento, CURDATE()) AS dias_restantes,
              CASE
                WHEN dc.fecha_vencimiento < CURDATE() THEN 'VENCIDO'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 30 THEN 'URGENTE (<=30d)'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 60 THEN 'PROXIMO (2 meses)'
                WHEN DATEDIFF(dc.fecha_vencimiento, CURDATE()) <= 90 THEN 'PROXIMO (3 meses)'
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
    const filas = enriquecerCaducidad(rows);

    if (formato === 'pdf') {
      if (filas.length === 0) {
        return res.status(404).json({ error: 'No hay datos para generar el reporte con los filtros seleccionados.' });
      }
      const subtitulo = dias === 'todos'
        ? `Todos los lotes con fecha de vencimiento registrada${buscar ? ' | Filtro: "' + buscar + '"' : ''}`
        : `Lotes con vencimiento en un lapso de ${dias} días (${Math.round(dias / 30)} meses aprox.) o ya vencidos${buscar ? ' | Filtro: "' + buscar + '"' : ''}`;

      return generarPdfTabla(
        res,
        `reporte_caducidad_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Reporte de Alertas de Caducidad y Vencimiento',
        subtitulo,
        [
          { titulo: 'Lote #', clave: 'id_detalle_compra', align: 'center' },
          { titulo: 'Producto', clave: 'producto', align: 'left' },
          { titulo: 'SKU', clave: 'sku', align: 'center' },
          { titulo: 'Disponible', clave: 'cantidad_disponible', align: 'center' },
          { titulo: 'Vencimiento', clave: 'fecha_vencimiento', align: 'center' },
          { titulo: 'Días rest.', clave: 'dias_texto', align: 'center' },
          { titulo: 'Estado', clave: 'estado', align: 'center' }
        ],
        filas
      );
    }

    res.json(filas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ========================================================
// 7. REPORTE DE MOVIMIENTOS HISTÓRICOS (ENTRADAS Y SALIDAS)
// ========================================================
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
        `Reporte General de Entradas y Salidas (${desde} a ${hasta})`,
        'Trazabilidad de movimientos físicos de almacén',
        [
          { titulo: 'Tipo', clave: 'tipo', align: 'center' },
          { titulo: 'Fecha', clave: 'fecha', align: 'left' },
          { titulo: 'Producto', clave: 'producto', align: 'left' },
          { titulo: 'Cantidad', clave: 'cantidad', align: 'center' },
          { titulo: 'Responsable', clave: 'usuario', align: 'left' },
          { titulo: 'Detalle/Tercero', clave: 'detalle', align: 'left' }
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
