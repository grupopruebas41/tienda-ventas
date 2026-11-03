'use strict';

const { plano, planos, patronBusqueda } = require('./utilidades');

const SELECT_BASE = `
  SELECT pr.*, pv.razon_social AS proveedor
  FROM productos pr
  JOIN proveedores pv ON pv.id = pr.proveedor_id`;

function crearProductosRepositorio(db) {
  return {
    listar({ busqueda, soloStockBajo } = {}) {
      const condiciones = [];
      const parametros = [];
      if (busqueda) {
        const patron = patronBusqueda(busqueda);
        condiciones.push(
          "(pr.nombre LIKE ? ESCAPE '\\' OR pr.codigo LIKE ? ESCAPE '\\' OR pr.categoria LIKE ? ESCAPE '\\')"
        );
        parametros.push(patron, patron, patron);
      }
      if (soloStockBajo) condiciones.push('pr.stock <= pr.stock_minimo');
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      return planos(db.prepare(`${SELECT_BASE} ${where} ORDER BY pr.nombre`).all(...parametros));
    },

    obtener(id) {
      return plano(db.prepare(`${SELECT_BASE} WHERE pr.id = ?`).get(id));
    },

    buscarPorCodigo(codigo) {
      return plano(db.prepare('SELECT * FROM productos WHERE codigo = ?').get(codigo));
    },

    crear(p) {
      const r = db
        .prepare(
          `INSERT INTO productos (codigo, nombre, categoria, precio_centimos, stock, stock_minimo, proveedor_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(p.codigo, p.nombre, p.categoria, p.precio_centimos, p.stock, p.stock_minimo, p.proveedor_id);
      return this.obtener(Number(r.lastInsertRowid));
    },

    actualizar(id, p) {
      db.prepare(
        `UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, precio_centimos = ?, stock = ?,
           stock_minimo = ?, proveedor_id = ?, actualizado_en = datetime('now', 'localtime')
         WHERE id = ?`
      ).run(p.codigo, p.nombre, p.categoria, p.precio_centimos, p.stock, p.stock_minimo, p.proveedor_id, id);
      return this.obtener(id);
    },

    descontarStock(id, cantidad) {
      return (
        db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?').run(cantidad, id, cantidad)
          .changes > 0
      );
    },

    devolverStock(id, cantidad) {
      db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(cantidad, id);
    },

    eliminar(id) {
      return db.prepare('DELETE FROM productos WHERE id = ?').run(id).changes > 0;
    },

    contarVentas(id) {
      return db.prepare('SELECT COUNT(*) AS total FROM venta_detalle WHERE producto_id = ?').get(id).total;
    },
  };
}

module.exports = { crearProductosRepositorio };
