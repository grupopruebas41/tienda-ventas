'use strict';

const { plano, planos } = require('./utilidades');

const SELECT_BASE = `
  SELECT v.*, c.nombre AS cliente, c.tipo_documento, c.numero_documento,
         (SELECT COUNT(*) FROM venta_detalle d WHERE d.venta_id = v.id) AS total_items
  FROM ventas v
  LEFT JOIN clientes c ON c.id = v.cliente_id`;

function crearVentasRepositorio(db) {
  return {
    listar() {
      return planos(db.prepare(`${SELECT_BASE} ORDER BY v.fecha DESC, v.id DESC`).all());
    },

    obtener(id) {
      const venta = plano(db.prepare(`${SELECT_BASE} WHERE v.id = ?`).get(id));
      if (!venta) return null;
      venta.detalle = planos(
        db
          .prepare(
            `SELECT d.*, p.codigo, p.nombre
             FROM venta_detalle d JOIN productos p ON p.id = d.producto_id
             WHERE d.venta_id = ? ORDER BY d.id`
          )
          .all(id)
      );
      return venta;
    },

    siguienteCorrelativo(serie) {
      const fila = db.prepare('SELECT MAX(correlativo) AS ultimo FROM ventas WHERE serie = ?').get(serie);
      return (fila.ultimo || 0) + 1;
    },

    crear(v) {
      const r = db
        .prepare(
          `INSERT INTO ventas (tipo_comprobante, serie, correlativo, cliente_id, subtotal_centimos, igv_centimos, total_centimos)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(v.tipo_comprobante, v.serie, v.correlativo, v.cliente_id, v.subtotal_centimos, v.igv_centimos, v.total_centimos);
      return Number(r.lastInsertRowid);
    },

    agregarDetalle(ventaId, d) {
      db.prepare(
        `INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario_centimos, importe_centimos)
         VALUES (?, ?, ?, ?, ?)`
      ).run(ventaId, d.producto_id, d.cantidad, d.precio_unitario_centimos, d.importe_centimos);
    },

    marcarAnulada(id) {
      db.prepare("UPDATE ventas SET estado = 'ANULADA' WHERE id = ?").run(id);
    },

    resumen() {
      return plano(
        db
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM clientes) AS clientes,
               (SELECT COUNT(*) FROM proveedores) AS proveedores,
               (SELECT COUNT(*) FROM productos) AS productos,
               (SELECT COUNT(*) FROM productos WHERE stock <= stock_minimo) AS productos_stock_bajo,
               (SELECT COUNT(*) FROM ventas WHERE estado = 'EMITIDA') AS ventas,
               (SELECT COALESCE(SUM(total_centimos), 0) FROM ventas WHERE estado = 'EMITIDA') AS total_vendido_centimos,
               (SELECT COALESCE(SUM(total_centimos), 0) FROM ventas
                  WHERE estado = 'EMITIDA' AND date(fecha) = date('now', 'localtime')) AS vendido_hoy_centimos`
          )
          .get()
      );
    },
  };
}

module.exports = { crearVentasRepositorio };
