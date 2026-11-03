'use strict';

const http = require('node:http');
const path = require('node:path');
const { abrirBaseDatos } = require('./db/conexion');
const { crearApp } = require('./app');

const PUERTO = Number(process.env.PUERTO || 3000);
const ARCHIVO_BD = process.env.DB_ARCHIVO || path.join(__dirname, '..', 'database', 'tienda.db');

const db = abrirBaseDatos({ archivo: ARCHIVO_BD, datosDemo: process.env.DATOS_DEMO !== '0' });
const { manejador } = crearApp({ db, registrarPeticiones: process.env.LOG !== '0' });

const servidor = http.createServer(manejador);
servidor.listen(PUERTO, () => {
  console.log(`Distribuidora El Mantaro — sistema de ventas`);
  console.log(`Base de datos: ${ARCHIVO_BD}`);
  console.log(`Abre http://localhost:${PUERTO} en tu navegador`);
});

function cerrar() {
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
