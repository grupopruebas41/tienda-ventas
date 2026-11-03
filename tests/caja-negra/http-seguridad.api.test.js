'use strict';

/**
 * PRUEBAS DE CAJA NEGRA — comportamiento HTTP general y seguridad
 * (ISO/IEC 25010: seguridad → integridad, confidencialidad; fiabilidad → tolerancia a fallos)
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('../helpers/servidor');

let srv;
before(async () => {
  srv = await iniciarServidor();
});
after(() => srv.cerrar());

describe('Caja negra: manejo de peticiones incorrectas', () => {
  it('CN-HTTP-01 JSON mal formado → 400 con mensaje claro', async () => {
    const r = await srv.peticion('POST', '/api/clientes', '{"nombre": "Ana"');
    assert.equal(r.status, 400);
    assert.equal(r.cuerpo.error, 'El JSON enviado no es válido.');
  });

  it('CN-HTTP-02 ruta inexistente → 404; método no permitido → 405', async () => {
    assert.equal((await srv.peticion('GET', '/api/inventario')).status, 404);
    assert.equal((await srv.peticion('PATCH', '/api/clientes')).status, 405);
  });

  it('CN-HTTP-03 id no numérico → 400', async () => {
    assert.equal((await srv.peticion('GET', '/api/productos/abc')).status, 400);
  });

  it('CN-HTTP-04 cuerpo mayor a 100 KB → 413', async () => {
    const r = await srv.peticion('POST', '/api/clientes', { nombre: 'x'.repeat(120 * 1024) });
    assert.equal(r.status, 413);
  });
});

describe('Caja negra: seguridad', () => {
  it('CN-SEG-01 inyección SQL en la búsqueda no altera datos', async () => {
    const antes = (await srv.peticion('GET', '/api/clientes')).cuerpo.total;
    const r = await srv.peticion('GET', `/api/clientes?q=${encodeURIComponent("' OR 1=1; DROP TABLE clientes; --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.total, 0);
    assert.equal((await srv.peticion('GET', '/api/clientes')).cuerpo.total, antes);
  });

  it('CN-SEG-02 los comodines % y _ se buscan como texto literal', async () => {
    const r = await srv.peticion('GET', '/api/productos?q=%25');
    assert.equal(r.cuerpo.total, 0);
  });

  it('CN-SEG-03 respuestas incluyen cabeceras de seguridad', async () => {
    const r = await srv.peticion('GET', '/api/salud');
    assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
    assert.equal(r.cabeceras.get('x-frame-options'), 'DENY');
    assert.match(r.cabeceras.get('content-security-policy'), /default-src 'self'/);
  });

  it('CN-SEG-04 no se puede leer archivos fuera de /public (path traversal)', async () => {
    const r = await fetch(`${srv.url}/..%2f..%2fpackage.json`);
    assert.notEqual(r.status, 200);
    const r2 = await fetch(`${srv.url}/css/..%2f..%2fsrc%2fserver.js`);
    assert.notEqual(r2.status, 200);
  });

  it('CN-SEG-05 el frontend y el validador compartido se sirven correctamente', async () => {
    const html = await fetch(`${srv.url}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get('content-type'), /text\/html/);
    const js = await fetch(`${srv.url}/shared/validaciones.js`);
    assert.equal(js.status, 200);
    assert.match(await js.text(), /validarRuc/);
  });
});
