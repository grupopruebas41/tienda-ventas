'use strict';

/**
 * PRUEBAS DE CAJA NEGRA — API de proveedores y productos
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('../helpers/servidor');

let srv;
before(async () => {
  srv = await iniciarServidor();
});
after(() => srv.cerrar());

const proveedor = (extra = {}) => ({
  ruc: '20605544330',
  razon_social: 'Proveedor de prueba S.A.C.',
  telefono: '964000111',
  ...extra,
});

let codigo = 100;
const producto = (extra = {}) => ({
  codigo: `OTR-${String(codigo++).padStart(4, '0')}`,
  nombre: 'Producto de prueba',
  categoria: 'Otros',
  precio: '10.00',
  stock: '10',
  stock_minimo: '2',
  proveedor_id: 2,
  ...extra,
});

describe('Caja negra: RUC del proveedor — particiones de equivalencia', () => {
  const casos = [
    { id: 'CN-PRV-01', ruc: '20131456787', esperado: 201, clase: 'CV válido (prefijo 20, dígito correcto)' },
    { id: 'CN-PRV-02', ruc: '2013145678', esperado: 422, clase: 'CI 10 dígitos' },
    { id: 'CN-PRV-03', ruc: '201314567870', esperado: 422, clase: 'CI 12 dígitos' },
    { id: 'CN-PRV-04', ruc: '30131456787', esperado: 422, clase: 'CI prefijo 30 no existe' },
    { id: 'CN-PRV-05', ruc: '20131456780', esperado: 422, clase: 'CI dígito verificador incorrecto' },
    { id: 'CN-PRV-06', ruc: '20605544330', esperado: 409, clase: 'CI RUC ya registrado' },
  ];
  for (const c of casos) {
    it(`${c.id} ${c.clase} → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/proveedores', proveedor({ ruc: c.ruc }));
      assert.equal(r.status, c.esperado);
    });
  }
});

describe('Caja negra: eliminar proveedor', () => {
  it('CN-PRV-07 proveedor con productos → 409; proveedor sin productos → 200', async () => {
    assert.equal((await srv.peticion('DELETE', '/api/proveedores/1')).status, 409);
    const nuevo = await srv.peticion('POST', '/api/proveedores', proveedor({ ruc: '20609988771' }));
    // 20609988771 ya existe en los datos de ejemplo (id 4) y tiene productos
    assert.equal(nuevo.status, 409);
    const libre = await srv.peticion('POST', '/api/proveedores', proveedor({ ruc: '10445566778' }));
    assert.equal(libre.status, 201);
    assert.equal((await srv.peticion('DELETE', `/api/proveedores/${libre.cuerpo.datos.id}`)).status, 200);
  });
});

describe('Caja negra: buscar y editar proveedor', () => {
  it('CN-PRV-08 buscar por razón social, RUC o contacto (sin importar tildes)', async () => {
    for (const texto of ['molinera', '20487654320', 'CCANTO']) {
      const r = await srv.peticion('GET', `/api/proveedores?q=${encodeURIComponent(texto)}`);
      assert.deepEqual(r.cuerpo.datos.map((p) => p.razon_social), ['Molinera Andina E.I.R.L.'], texto);
    }
  });

  it('CN-PRV-09 editar proveedor: cambia el contacto; usar el RUC de otro proveedor → 409', async () => {
    const actual = (await srv.peticion('GET', '/api/proveedores/2')).cuerpo.datos;
    const r = await srv.peticion('PUT', '/api/proveedores/2', { ...actual, contacto: 'Sonia Yauri' });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.datos.contacto, 'Sonia Yauri');
    const choque = await srv.peticion('PUT', '/api/proveedores/2', { ...actual, ruc: '20601122333' });
    assert.equal(choque.status, 409);
  });
});

describe('Caja negra: precio del producto — valores límite (0.01 a 99,999.99)', () => {
  const casos = [
    { id: 'CN-PRD-01', precio: '0', esperado: 422 },
    { id: 'CN-PRD-02', precio: '0.01', esperado: 201 },
    { id: 'CN-PRD-03', precio: '99999.99', esperado: 201 },
    { id: 'CN-PRD-04', precio: '100000', esperado: 422 },
    { id: 'CN-PRD-05', precio: '-3.50', esperado: 422 },
    { id: 'CN-PRD-06', precio: '4.555', esperado: 422 },
    { id: 'CN-PRD-07', precio: 'diez', esperado: 422 },
    { id: 'CN-PRD-08', precio: '1e2', esperado: 422 },
  ];
  for (const c of casos) {
    it(`${c.id} precio "${c.precio}" → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/productos', producto({ precio: c.precio }));
      assert.equal(r.status, c.esperado, JSON.stringify(r.cuerpo));
    });
  }
});

describe('Caja negra: stock del producto — valores límite (0 a 99,999)', () => {
  const casos = [
    { id: 'CN-PRD-09', stock: '-1', esperado: 422 },
    { id: 'CN-PRD-10', stock: '0', esperado: 201 },
    { id: 'CN-PRD-11', stock: '99999', esperado: 201 },
    { id: 'CN-PRD-12', stock: '100000', esperado: 422 },
    { id: 'CN-PRD-13', stock: '2.5', esperado: 422 },
    { id: 'CN-PRD-14', stock: '0x10', esperado: 422 },
  ];
  for (const c of casos) {
    it(`${c.id} stock "${c.stock}" → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/productos', producto({ stock: c.stock }));
      assert.equal(r.status, c.esperado, JSON.stringify(r.cuerpo));
    });
  }
});

describe('Caja negra: reglas de productos', () => {
  it('CN-PRD-15 código con formato incorrecto → 422; código repetido → 409', async () => {
    assert.equal((await srv.peticion('POST', '/api/productos', producto({ codigo: 'LECHE1' }))).status, 422);
    assert.equal((await srv.peticion('POST', '/api/productos', producto({ codigo: 'lac-0001' }))).status, 409);
  });

  it('CN-PRD-16 proveedor inexistente → 422 en el campo proveedor_id', async () => {
    const r = await srv.peticion('POST', '/api/productos', producto({ proveedor_id: 999 }));
    assert.equal(r.status, 422);
    assert.ok(r.cuerpo.errores.proveedor_id);
  });

  it('CN-PRD-17 el filtro stockBajo=1 solo devuelve productos con stock ≤ mínimo', async () => {
    const r = await srv.peticion('GET', '/api/productos?stockBajo=1');
    assert.equal(r.status, 200);
    assert.ok(r.cuerpo.datos.length > 0);
    assert.ok(r.cuerpo.datos.every((p) => p.stock <= p.stock_minimo));
  });

  it('CN-PRD-18 no se elimina un producto que figura en ventas; uno nuevo sí', async () => {
    assert.equal((await srv.peticion('DELETE', '/api/productos/1')).status, 409);
    const nuevo = await srv.peticion('POST', '/api/productos', producto());
    assert.equal((await srv.peticion('DELETE', `/api/productos/${nuevo.cuerpo.datos.id}`)).status, 200);
  });

  it('CN-PRD-19 editar un producto actualiza el precio mostrado', async () => {
    const nuevo = await srv.peticion('POST', '/api/productos', producto());
    const r = await srv.peticion('PUT', `/api/productos/${nuevo.cuerpo.datos.id}`, producto({ codigo: nuevo.cuerpo.datos.codigo, precio: '12.30' }));
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.datos.precio_centimos, 1230);
  });
});
