'use strict';

/**
 * PRUEBAS UNITARIAS — enrutador HTTP (src/http/router.js) y AppError
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crearRouter, compilarPatron } = require('../../src/http/router');
const { AppError } = require('../../src/errores');

describe('Unitarias: enrutador', () => {
  it('PU-RUT-01 compilarPatron extrae los nombres de parámetros', () => {
    const { regex, nombres } = compilarPatron('/api/ventas/:id/anular');
    assert.deepEqual(nombres, ['id']);
    assert.ok(regex.test('/api/ventas/15/anular'));
    assert.ok(!regex.test('/api/ventas/15'));
  });

  it('PU-RUT-02 resolver devuelve el manejador y los parámetros', () => {
    const router = crearRouter();
    const manejador = () => 'ok';
    router.get('/api/clientes/:id', manejador);
    const r = router.resolver('GET', '/api/clientes/42');
    assert.equal(r.manejador, manejador);
    assert.deepEqual(r.params, { id: '42' });
  });

  it('PU-RUT-03 resolver distingue ruta inexistente (null) de método no permitido', () => {
    const router = crearRouter();
    router.get('/api/clientes', () => {});
    assert.equal(router.resolver('GET', '/api/otra'), null);
    assert.deepEqual(router.resolver('PATCH', '/api/clientes'), { metodoNoPermitido: true });
  });

  it('PU-RUT-04 AppError conserva status y errores por campo', () => {
    const e = AppError.validacion({ nombre: 'Obligatorio' });
    assert.equal(e.status, 422);
    assert.deepEqual(e.errores, { nombre: 'Obligatorio' });
    assert.equal(AppError.noEncontrado('El cliente').status, 404);
    assert.equal(AppError.conflicto('x').status, 409);
  });
});
