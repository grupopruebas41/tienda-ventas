'use strict';

const { plano, planos, patronBusqueda } = require('./utilidades');

/** Acceso a datos de la tabla clientes. Solo SQL parametrizado (evita inyección SQL). */
function crearClientesRepositorio(db) {
  return {
    listar(busqueda) {
      if (busqueda) {
        return planos(
          db
            .prepare(
              `SELECT * FROM clientes
               WHERE normalizar(nombre) LIKE ? ESCAPE '\\' OR normalizar(numero_documento) LIKE ? ESCAPE '\\' OR normalizar(email) LIKE ? ESCAPE '\\'
               ORDER BY nombre`
            )
            .all(patronBusqueda(busqueda), patronBusqueda(busqueda), patronBusqueda(busqueda))
        );
      }
      return planos(db.prepare('SELECT * FROM clientes ORDER BY nombre').all());
    },

    obtener(id) {
      return plano(db.prepare('SELECT * FROM clientes WHERE id = ?').get(id));
    },

    buscarPorDocumento(numeroDocumento) {
      return plano(db.prepare('SELECT * FROM clientes WHERE numero_documento = ?').get(numeroDocumento));
    },

    crear(c) {
      const r = db
        .prepare(
          `INSERT INTO clientes (tipo_documento, numero_documento, nombre, email, telefono, direccion)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(c.tipo_documento, c.numero_documento, c.nombre, c.email, c.telefono, c.direccion);
      return this.obtener(Number(r.lastInsertRowid));
    },

    actualizar(id, c) {
      db.prepare(
        `UPDATE clientes SET tipo_documento = ?, numero_documento = ?, nombre = ?, email = ?,
           telefono = ?, direccion = ?, actualizado_en = datetime('now', 'localtime')
         WHERE id = ?`
      ).run(c.tipo_documento, c.numero_documento, c.nombre, c.email, c.telefono, c.direccion, id);
      return this.obtener(id);
    },

    eliminar(id) {
      return db.prepare('DELETE FROM clientes WHERE id = ?').run(id).changes > 0;
    },

    contarVentas(id) {
      return db.prepare('SELECT COUNT(*) AS total FROM ventas WHERE cliente_id = ?').get(id).total;
    },
  };
}

module.exports = { crearClientesRepositorio };
