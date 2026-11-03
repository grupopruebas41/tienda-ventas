'use strict';

const { AppError } = require('../errores');

const LIMITE_CUERPO_BYTES = 100 * 1024; // 100 KB

const CABECERAS_SEGURIDAD = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
});

function enviarJson(res, status, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, {
    ...CABECERAS_SEGURIDAD,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  });
  res.end(texto);
}

/** Lee y convierte el cuerpo JSON de la petición. */
function leerJson(req) {
  return new Promise((resolve, reject) => {
    const tipo = req.headers['content-type'] || '';
    let tamano = 0;
    let excedido = false;
    const partes = [];
    req.on('data', (parte) => {
      tamano += parte.length;
      // DEF-06: no se corta la conexión; se descarta el resto y se responde 413 al terminar
      if (tamano > LIMITE_CUERPO_BYTES) {
        excedido = true;
        partes.length = 0;
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      if (excedido) return reject(new AppError(413, 'La información enviada es demasiado grande (máximo 100 KB).'));
      const texto = Buffer.concat(partes).toString('utf8');
      if (texto.trim() === '') return resolve({});
      if (!tipo.includes('application/json')) {
        return reject(new AppError(415, 'Envía los datos en formato JSON (Content-Type: application/json).'));
      }
      try {
        const datos = JSON.parse(texto);
        if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
          return reject(AppError.solicitudInvalida('El cuerpo debe ser un objeto JSON.'));
        }
        resolve(datos);
      } catch {
        reject(AppError.solicitudInvalida('El JSON enviado no es válido.'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = { enviarJson, leerJson, CABECERAS_SEGURIDAD, LIMITE_CUERPO_BYTES };
