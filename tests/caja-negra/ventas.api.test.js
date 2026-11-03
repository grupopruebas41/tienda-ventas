'use strict';

/**
 * PRUEBAS DE CAJA NEGRA — API de ventas (/api/ventas)
 * Especificación: la venta descuenta stock; la factura exige cliente con RUC;
 * la boleta mayor a S/ 700 exige cliente identificado; la cantidad va de 1 a 1000;
 * anular repone el stock y solo puede hacerse una vez.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('../helpers/servidor');

let srv;
before(async () => {
  srv = await iniciarServidor();
  // Producto de prueba con mucho stock para los valores límite de cantidad
  await srv.peticion('POST', '/api/productos', {
    codigo: 'OTR-0900',
    nombre: 'Bolsa ecológica',
    categoria: 'Otros',
    precio: '0.50',
    stock: '5000',
    stock_minimo: '10',
    proveedor_id: 4,
  });
});
after(() => srv.cerrar());

const idBolsa = async () => (await srv.peticion('GET', '/api/productos?q=OTR-0900')).cuerpo.datos[0].id;
const stock = async (id) => (await srv.peticion('GET', `/api/productos/${id}`)).cuerpo.datos.stock;

describe('Caja negra: cantidad por línea — valores límite (1 a 1000)', () => {
  const casos = [
    { id: 'CN-VEN-01', cantidad: 0, esperado: 422 },
    { id: 'CN-VEN-02', cantidad: 1, esperado: 201 },
    { id: 'CN-VEN-03', cantidad: 1000, esperado: 201 },
    { id: 'CN-VEN-04', cantidad: 1001, esperado: 422 },
    { id: 'CN-VEN-05', cantidad: 1.5, esperado: 422 },
  ];
  for (const c of casos) {
    it(`${c.id} cantidad ${c.cantidad} → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/ventas', {
        tipo_comprobante: 'BOLETA',
        cliente_id: 2,
        items: [{ producto_id: await idBolsa(), cantidad: c.cantidad }],
      });
      assert.equal(r.status, c.esperado, JSON.stringify(r.cuerpo));
    });
  }
});

describe('Caja negra: tipo de comprobante y cliente', () => {
  it('CN-VEN-06 factura a cliente con RUC → 201 con serie F001', async () => {
    const r = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'FACTURA', cliente_id: 3, items: [{ producto_id: 7, cantidad: 2 }] });
    assert.equal(r.status, 201);
    assert.match(r.cuerpo.datos.comprobante, /^F001-\d{8}$/);
  });

  it('CN-VEN-07 factura a cliente con DNI → 422', async () => {
    const r = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'FACTURA', cliente_id: 1, items: [{ producto_id: 7, cantidad: 1 }] });
    assert.equal(r.status, 422);
  });

  it('CN-VEN-08 boleta sin cliente de S/ 700.00 (límite) → 201; de S/ 700.50 → 422', async () => {
    const bolsa = await idBolsa();
    const limite = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA', items: [{ producto_id: bolsa, cantidad: 1000 }, { producto_id: 1, cantidad: 0 }].slice(0, 1) });
    // 1000 × S/ 0.50 = S/ 500 → para llegar a 700 se suman 400 × 0.50
    assert.equal(limite.status, 201);
    const exacto = await srv.peticion('POST', '/api/ventas', {
      tipo_comprobante: 'BOLETA',
      items: [{ producto_id: bolsa, cantidad: 1000 }, { producto_id: bolsa, cantidad: 400 }],
    });
    assert.equal(exacto.status, 201);
    assert.equal(exacto.cuerpo.datos.total_centimos, 70000);
    const excede = await srv.peticion('POST', '/api/ventas', {
      tipo_comprobante: 'BOLETA',
      items: [{ producto_id: bolsa, cantidad: 1000 }, { producto_id: bolsa, cantidad: 401 }],
    });
    assert.equal(excede.status, 422);
  });

  it('CN-VEN-09 tipo de comprobante inválido o items ausentes → 422', async () => {
    assert.equal((await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'NOTA', items: [{ producto_id: 1, cantidad: 1 }] })).status, 422);
    assert.equal((await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA' })).status, 422);
    const sinProducto = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA', items: [{ producto_id: 'abc', cantidad: 1 }] });
    assert.equal(sinProducto.status, 422);
    assert.match(sinProducto.cuerpo.errores.items, /elige un producto/);
  });
});

describe('Caja negra: stock y anulación', () => {
  it('CN-VEN-10 vender descuenta stock, anular lo repone y anular dos veces → 409', async () => {
    const antes = await stock(8);
    const venta = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA', items: [{ producto_id: 8, cantidad: 5 }] });
    assert.equal(venta.status, 201);
    assert.equal(await stock(8), antes - 5);

    const anulada = await srv.peticion('POST', `/api/ventas/${venta.cuerpo.datos.id}/anular`);
    assert.equal(anulada.status, 200);
    assert.equal(anulada.cuerpo.datos.estado, 'ANULADA');
    assert.equal(await stock(8), antes);

    assert.equal((await srv.peticion('POST', `/api/ventas/${venta.cuerpo.datos.id}/anular`)).status, 409);
  });

  it('CN-VEN-11 vender más que el stock → 409 con el stock disponible en el mensaje', async () => {
    const r = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA', items: [{ producto_id: 6, cantidad: 4 }] });
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error, /solo quedan 3/);
  });

  it('CN-VEN-12 el resumen suma solo ventas emitidas (no anuladas)', async () => {
    const r = await srv.peticion('GET', '/api/resumen');
    const lista = await srv.peticion('GET', '/api/ventas');
    const esperado = lista.cuerpo.datos.filter((v) => v.estado === 'EMITIDA').reduce((s, v) => s + v.total_centimos, 0);
    assert.equal(r.cuerpo.datos.total_vendido_centimos, esperado);
  });

  it('CN-VEN-13 el detalle de la venta conserva el precio del momento de la venta', async () => {
    const venta = await srv.peticion('POST', '/api/ventas', { tipo_comprobante: 'BOLETA', items: [{ producto_id: 10, cantidad: 1 }] });
    const actual = (await srv.peticion('GET', '/api/productos/10')).cuerpo.datos;
    await srv.peticion('PUT', '/api/productos/10', { ...actual, precio: '9.90' });
    const detalle = await srv.peticion('GET', `/api/ventas/${venta.cuerpo.datos.id}`);
    assert.equal(detalle.cuerpo.datos.detalle[0].precio_unitario_centimos, 390);
  });
});
