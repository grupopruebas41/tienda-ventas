'use strict';

/**
 * Enrutador mínimo: registra rutas como "GET /api/clientes/:id" y extrae
 * los parámetros de la URL. Se usa en lugar de Express para que el proyecto
 * funcione sin instalar dependencias.
 */
function compilarPatron(patron) {
  const nombres = [];
  const regex = patron
    .split('/')
    .map((parte) => {
      if (parte.startsWith(':')) {
        nombres.push(parte.slice(1));
        return '([^/]+)';
      }
      return parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regex}/?$`), nombres };
}

function crearRouter() {
  const rutas = [];

  function registrar(metodo, patron, manejador) {
    rutas.push({ metodo, ...compilarPatron(patron), manejador });
  }

  /**
   * Busca la ruta. Devuelve:
   *  - { manejador, params } si coincide método y ruta
   *  - { metodoNoPermitido: true } si la ruta existe con otro método
   *  - null si no existe
   */
  function resolver(metodo, ruta) {
    let existeRuta = false;
    for (const r of rutas) {
      const coincidencia = r.regex.exec(ruta);
      if (!coincidencia) continue;
      existeRuta = true;
      if (r.metodo !== metodo) continue;
      const params = {};
      r.nombres.forEach((nombre, i) => {
        params[nombre] = decodeURIComponent(coincidencia[i + 1]);
      });
      return { manejador: r.manejador, params };
    }
    return existeRuta ? { metodoNoPermitido: true } : null;
  }

  return {
    get: (p, m) => registrar('GET', p, m),
    post: (p, m) => registrar('POST', p, m),
    put: (p, m) => registrar('PUT', p, m),
    delete: (p, m) => registrar('DELETE', p, m),
    resolver,
  };
}

module.exports = { crearRouter, compilarPatron };
