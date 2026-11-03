'use strict';

/** Borra database/tienda.db y la vuelve a crear con el esquema y los datos de ejemplo. */
const fs = require('node:fs');
const path = require('node:path');
const { abrirBaseDatos } = require('../src/db/conexion');

const archivo = process.env.DB_ARCHIVO || path.join(__dirname, '..', 'database', 'tienda.db');
for (const sufijo of ['', '-wal', '-shm']) {
  fs.rmSync(archivo + sufijo, { force: true });
}
const db = abrirBaseDatos({ archivo, datosDemo: true });
const { total } = db.prepare('SELECT COUNT(*) AS total FROM productos').get();
db.close();
console.log(`Base de datos reiniciada en ${archivo} (${total} productos de ejemplo).`);
