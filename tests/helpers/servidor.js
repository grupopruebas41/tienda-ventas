'use strict';

const http = require('node:http');
const { abrirBaseDatos } = require('../../src/db/conexion');
const { crearApp } = require('../../src/app');

/**
 * Levanta la aplicación real en un puerto libre con una base de datos SQLite
 * EN MEMORIA (con los datos de ejemplo). Cada archivo de prueba obtiene una BD
 * limpia, por eso las pruebas no dependen unas de otras.
 */
async function iniciarServidor({ datosDemo = true } = {}) {
  const db = abrirBaseDatos({ archivo: ':memory:', datosDemo });
  const { manejador } = crearApp({ db });
  const servidor = http.createServer(manejador);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${servidor.address().port}`;

  /** Hace una petición y devuelve { status, cuerpo, cabeceras }. */
  async function peticion(metodo, ruta, cuerpo, cabecerasExtra = {}) {
    const respuesta = await fetch(url + ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json', ...cabecerasExtra } : cabecerasExtra,
      body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      json = null;
    }
    return { status: respuesta.status, cuerpo: json, texto, cabeceras: respuesta.headers };
  }

  async function cerrar() {
    await new Promise((resolve) => servidor.close(resolve));
    db.close();
  }

  return { url, db, peticion, cerrar };
}

module.exports = { iniciarServidor };
