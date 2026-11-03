'use strict';

const { plano, planos, patronBusqueda } = require('./utilidades');

const SELECT_BASE = `
  SELECT p.*, (SELECT COUNT(*) FROM productos pr WHERE pr.proveedor_id = p.id) AS total_productos
  FROM proveedores p`;

function crearProveedoresRepositorio(db) {
  return {
    listar(busqueda) {
      if (busqueda) {
        const patron = patronBusqueda(busqueda);
        return planos(
          db
            .prepare(
              `${SELECT_BASE}
               WHERE normalizar(p.razon_social) LIKE ? ESCAPE '\\' OR normalizar(p.ruc) LIKE ? ESCAPE '\\' OR normalizar(p.contacto) LIKE ? ESCAPE '\\'
               ORDER BY p.razon_social`
            )
            .all(patron, patron, patron)
        );
      }
      return planos(db.prepare(`${SELECT_BASE} ORDER BY p.razon_social`).all());
    },

    obtener(id) {
      return plano(db.prepare(`${SELECT_BASE} WHERE p.id = ?`).get(id));
    },

    buscarPorRuc(ruc) {
      return plano(db.prepare('SELECT * FROM proveedores WHERE ruc = ?').get(ruc));
    },

    crear(p) {
      const r = db
        .prepare(
          `INSERT INTO proveedores (ruc, razon_social, contacto, telefono, email, direccion)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(p.ruc, p.razon_social, p.contacto, p.telefono, p.email, p.direccion);
      return this.obtener(Number(r.lastInsertRowid));
    },

    actualizar(id, p) {
      db.prepare(
        `UPDATE proveedores SET ruc = ?, razon_social = ?, contacto = ?, telefono = ?, email = ?,
           direccion = ?, actualizado_en = datetime('now', 'localtime')
         WHERE id = ?`
      ).run(p.ruc, p.razon_social, p.contacto, p.telefono, p.email, p.direccion, id);
      return this.obtener(id);
    },

    eliminar(id) {
      return db.prepare('DELETE FROM proveedores WHERE id = ?').run(id).changes > 0;
    },

    contarProductos(id) {
      return db.prepare('SELECT COUNT(*) AS total FROM productos WHERE proveedor_id = ?').get(id).total;
    },
  };
}

module.exports = { crearProveedoresRepositorio };
