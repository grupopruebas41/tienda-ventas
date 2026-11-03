'use strict';

/**
 * PRUEBAS DE CAJA BLANCA — cobertura de ramas de funciones auxiliares
 *   calcularTotales(): rama de arreglo vacío / no arreglo y rama normal
 *   validarProducto(): ramas del código y del proveedor
 *   patronBusqueda():  rama de escape de comodines LIKE
 *   enTransaccion():   rama COMMIT y rama ROLLBACK
 *   leerJson():        ramas de cuerpo vacío, JSON inválido, no-objeto, tipo incorrecto
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { calcularTotales } = require('../../src/dominio/calculos');
const { validarProducto } = require('../../src/shared/validaciones');
const { patronBusqueda } = require('../../src/repositorios/utilidades');
const { abrirBaseDatos, enTransaccion } = require('../../src/db/conexion');
const { leerJson } = require('../../src/http/utilidadesHttp');

function peticionFalsa(texto, tipo = 'application/json') {
  const req = Readable.from(texto ? [Buffer.from(texto)] : []);
  req.headers = { 'content-type': tipo };
  return req;
}

describe('Caja blanca: calcularTotales', () => {
  it('CB-CAL-01 rama "no es arreglo o está vacío" devuelve ceros', () => {
    const cero = { subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 };
    assert.deepEqual(calcularTotales([]), cero);
    assert.deepEqual(calcularTotales(undefined), cero);
  });

  it('CB-CAL-02 rama normal: el bucle recorre todas las líneas', () => {
    const t = calcularTotales([
      { cantidad: 2, precioUnitarioCentimos: 450 },
      { cantidad: 1, precioUnitarioCentimos: 1250 },
      { cantidad: 1, precioUnitarioCentimos: 350 },
    ]);
    assert.deepEqual(t, { subtotalCentimos: 2119, igvCentimos: 381, totalCentimos: 2500 });
  });
});

describe('Caja blanca: validarProducto — ramas de código y proveedor', () => {
  const base = { nombre: 'Azúcar rubia 1 kg', categoria: 'Abarrotes', precio: '4.20', stock: '1', stock_minimo: '1' };

  it('CB-PRO-01 código vacío / formato incorrecto / correcto', () => {
    assert.equal(validarProducto({ ...base, codigo: '', proveedor_id: 1 }).errores.codigo, 'El código es obligatorio.');
    assert.match(validarProducto({ ...base, codigo: 'AB-01', proveedor_id: 1 }).errores.codigo, /ABC-0001/);
    assert.equal(validarProducto({ ...base, codigo: 'aba-0001', proveedor_id: 1 }).errores.codigo, undefined);
  });

  it('CB-PRO-02 proveedor vacío / no entero / válido', () => {
    assert.equal(validarProducto({ ...base, codigo: 'ABA-0001', proveedor_id: '' }).errores.proveedor_id, 'Elige un proveedor.');
    assert.match(validarProducto({ ...base, codigo: 'ABA-0001', proveedor_id: '2.5' }).errores.proveedor_id, /no es válido/);
    assert.equal(validarProducto({ ...base, codigo: 'ABA-0001', proveedor_id: '2' }).valido, true);
  });
});

describe('Caja blanca: utilidades de datos', () => {
  it('CB-BD-01 patronBusqueda escapa % y _ (rama con comodines) y envuelve en %', () => {
    assert.equal(patronBusqueda('50%_off'), '%50\\%\\_off%');
    assert.equal(patronBusqueda(undefined), '%%');
  });

  it('CB-BD-03 normalizarTexto: rama null y rama de texto con tildes/ñ (regresión DEF-05)', () => {
    const { normalizarTexto } = require('../../src/db/conexion');
    assert.equal(normalizarTexto(null), null);
    assert.equal(normalizarTexto('Ñaupari NÚÑEZ'), 'naupari nunez');
    assert.equal(patronBusqueda('Núñez'), '%nunez%');
  });

  it('CB-BD-02 enTransaccion: rama COMMIT guarda y rama ROLLBACK revierte', () => {
    const db = abrirBaseDatos({ archivo: ':memory:', datosDemo: true });
    enTransaccion(db, () => db.prepare("UPDATE productos SET stock = 1 WHERE id = 1").run());
    assert.equal(db.prepare('SELECT stock FROM productos WHERE id = 1').get().stock, 1);
    assert.throws(() =>
      enTransaccion(db, () => {
        db.prepare('UPDATE productos SET stock = 2 WHERE id = 1').run();
        throw new Error('falla simulada');
      })
    );
    assert.equal(db.prepare('SELECT stock FROM productos WHERE id = 1').get().stock, 1);
    db.close();
  });
});

describe('Caja blanca: leerJson — ramas del cuerpo HTTP', () => {
  it('CB-HTTP-01 cuerpo vacío devuelve objeto vacío', async () => {
    assert.deepEqual(await leerJson(peticionFalsa('')), {});
  });

  it('CB-HTTP-02 Content-Type distinto de JSON → 415', async () => {
    await assert.rejects(leerJson(peticionFalsa('a=1', 'text/plain')), { status: 415 });
  });

  it('CB-HTTP-03 JSON mal formado → 400', async () => {
    await assert.rejects(leerJson(peticionFalsa('{"a":')), { status: 400 });
  });

  it('CB-HTTP-04 JSON válido pero no objeto (arreglo o null) → 400', async () => {
    await assert.rejects(leerJson(peticionFalsa('[1,2]')), { status: 400 });
    await assert.rejects(leerJson(peticionFalsa('null')), { status: 400 });
  });

  it('CB-HTTP-05 JSON objeto válido se devuelve tal cual', async () => {
    assert.deepEqual(await leerJson(peticionFalsa('{"nombre":"Ana"}')), { nombre: 'Ana' });
  });
});
