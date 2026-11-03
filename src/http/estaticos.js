'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CABECERAS_SEGURIDAD } = require('./utilidadesHttp');

const TIPOS = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
});

/**
 * Sirve archivos de una carpeta evitando "path traversal" (../../etc/passwd).
 * Devuelve true si respondió, false si el archivo no existe.
 */
function crearServidorEstatico(carpetaRaiz, prefijo = '/') {
  const raiz = path.resolve(carpetaRaiz);
  return function servir(req, res, ruta) {
    if (!ruta.startsWith(prefijo)) return false;
    let relativa = decodeURIComponent(ruta.slice(prefijo.length));
    if (relativa === '' || relativa.endsWith('/')) relativa += 'index.html';
    const archivo = path.resolve(raiz, relativa);
    if (archivo !== raiz && !archivo.startsWith(raiz + path.sep)) return false;
    let datos;
    try {
      if (!fs.statSync(archivo).isFile()) return false;
      datos = fs.readFileSync(archivo);
    } catch {
      return false;
    }
    res.writeHead(200, {
      ...CABECERAS_SEGURIDAD,
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Content-Length': datos.length,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : datos);
    return true;
  };
}

module.exports = { crearServidorEstatico };
