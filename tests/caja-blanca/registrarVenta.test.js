'use strict';

/**
 * PRUEBAS DE CAJA BLANCA — ventasServicio.registrar()
 *
 * Grafo de flujo con 10 nodos predicado:
 *   D1  ¿tipo de comprobante válido?            (registrar)
 *   D2  ¿items es un arreglo no vacío?           (validarItems)
 *   D3  ¿cada línea tiene producto y cantidad válidos?  (validarItems, bucle)
 *   D4  ¿se indicó cliente?                      (obtenerCliente)
 *   D5  ¿el cliente existe?                      (obtenerCliente)
 *   D6  ¿el producto existe?                     (prepararLineas, bucle)
 *   D7  ¿stock suficiente?                       (prepararLineas)
 *   D8  ¿factura sin cliente con RUC?            (verificarReglasComprobante)
 *   D9  ¿boleta > S/ 700 sin cliente?            (verificarReglasComprobante)
 *   D10 ¿se pudo descontar el stock?             (transacción)
 * Complejidad ciclomática V(G) = P + 1 = 10 + 1 = 11 caminos independientes.
 *
 * Se usa la BD SQLite en memoria con los datos de ejemplo para que el
 * recorrido sea el real, salvo el camino 9 que necesita simular una
 * condición de carrera con un doble de prueba.
 */
const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBaseDatos } = require('../../src/db/conexion');
const { crearApp } = require('../../src/app');
const { crearVentasServicio } = require('../../src/servicios/ventasServicio');

// Datos de ejemplo (database/seed.sql):
//  cliente 1 = DNI, cliente 3 = RUC; producto 1 = Leche S/ 4.50 stock 60;
//  producto 2 = Queso S/ 16.90 stock 18; producto 6 = Maca S/ 18.00 stock 3
let db;
let ventas;

beforeEach(() => {
  db = abrirBaseDatos({ archivo: ':memory:', datosDemo: true });
  ventas = crearApp({ db }).servicios.ventas;
});

function stockDe(id) {
  return db.prepare('SELECT stock FROM productos WHERE id = ?').get(id).stock;
}

function totalVentas() {
  return db.prepare('SELECT COUNT(*) AS n FROM ventas').get().n;
}

/** Ejecuta fn y devuelve el AppError lanzado. */
function capturar(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  assert.fail('Se esperaba un error');
}

describe('Caja blanca: registrar() — 11 caminos independientes', () => {
  it('CB-VEN-01 camino 1: D1 falso → tipo inválido (422)', () => {
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'TICKET', items: [{ producto_id: 1, cantidad: 1 }] }));
    assert.equal(e.status, 422);
    assert.ok(e.errores.tipo_comprobante);
  });

  it('CB-VEN-02 camino 2: D2 falso → sin items (422)', () => {
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'BOLETA', items: [] }));
    assert.equal(e.status, 422);
    assert.match(e.errores.items, /al menos un producto/);
  });

  it('CB-VEN-03 camino 3: D3 falso → cantidad 0 en la línea 2 (422)', () => {
    const e = capturar(() =>
      ventas.registrar({
        tipo_comprobante: 'BOLETA',
        items: [
          { producto_id: 1, cantidad: 1 },
          { producto_id: 2, cantidad: 0 },
        ],
      })
    );
    assert.equal(e.status, 422);
    assert.match(e.errores.items, /^Línea 2/);
  });

  it('CB-VEN-04 camino 4: D4 verdadero, D5 falso → cliente inexistente (422)', () => {
    const e = capturar(() =>
      ventas.registrar({ tipo_comprobante: 'BOLETA', cliente_id: 999, items: [{ producto_id: 1, cantidad: 1 }] })
    );
    assert.equal(e.status, 422);
    assert.ok(e.errores.cliente_id);
  });

  it('CB-VEN-05 camino 5: D6 falso → producto inexistente (422)', () => {
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 999, cantidad: 1 }] }));
    assert.equal(e.status, 422);
    assert.match(e.errores.items, /no existe/);
  });

  it('CB-VEN-06 camino 6: D7 falso → stock insuficiente (409) y el stock no cambia', () => {
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 6, cantidad: 4 }] }));
    assert.equal(e.status, 409);
    assert.equal(stockDe(6), 3);
  });

  it('CB-VEN-07 camino 7: D8 verdadero → factura con cliente DNI (422)', () => {
    const e = capturar(() =>
      ventas.registrar({ tipo_comprobante: 'FACTURA', cliente_id: 1, items: [{ producto_id: 1, cantidad: 1 }] })
    );
    assert.equal(e.status, 422);
    assert.match(e.errores.cliente_id, /RUC/);
  });

  it('CB-VEN-08 camino 8: D9 verdadero → boleta de S/ 760.50 sin cliente (422)', () => {
    // 45 quesos × S/ 16.90 = S/ 760.50 > S/ 700 — se reabastece primero
    db.prepare('UPDATE productos SET stock = 100 WHERE id = 2').run();
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 2, cantidad: 45 }] }));
    assert.equal(e.status, 422);
    assert.match(e.errores.cliente_id, /700/);
  });

  it('CB-VEN-09 camino 9: D10 falso → el stock cambió dentro de la transacción (409, rollback)', () => {
    const appReal = crearApp({ db });
    const productosRepositorio = {
      ...appReal.repos.productos,
      descontarStock: mock.fn(() => false), // simula que otra caja vendió el stock
    };
    const servicio = crearVentasServicio({
      ventasRepositorio: appReal.repos.ventas,
      productosRepositorio,
      clientesRepositorio: appReal.repos.clientes,
      transaccion: (fn) => require('../../src/db/conexion').enTransaccion(db, fn),
    });
    const antes = totalVentas();
    const e = capturar(() => servicio.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 1, cantidad: 1 }] }));
    assert.equal(e.status, 409);
    assert.equal(totalVentas(), antes, 'la cabecera de la venta debe revertirse');
  });

  it('CB-VEN-10 camino 10: D4 falso y todo válido → boleta sin cliente registrada', () => {
    const v = ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 1, cantidad: 2 }] });
    assert.equal(v.comprobante, 'B001-00000002');
    assert.equal(v.cliente_id, null);
    assert.equal(v.total_centimos, 900);
    assert.equal(stockDe(1), 58);
  });

  it('CB-VEN-11 camino 11: D4, D5 verdaderos, D8 falso → factura con RUC registrada', () => {
    const v = ventas.registrar({
      tipo_comprobante: 'FACTURA',
      cliente_id: 3,
      items: [
        { producto_id: 1, cantidad: 2 },
        { producto_id: 1, cantidad: 1 },
      ],
    });
    assert.equal(v.comprobante, 'F001-00000002');
    assert.equal(v.detalle.length, 1, 'las líneas repetidas se agrupan');
    assert.equal(v.detalle[0].cantidad, 3);
    assert.equal(v.subtotal_centimos + v.igv_centimos, v.total_centimos);
  });
});

describe('Caja blanca: cobertura de condiciones en las reglas del comprobante', () => {
  it('CB-VEN-12 factura SIN cliente (condición !cliente verdadera)', () => {
    const e = capturar(() => ventas.registrar({ tipo_comprobante: 'FACTURA', items: [{ producto_id: 1, cantidad: 1 }] }));
    assert.match(e.errores.cliente_id, /RUC/);
  });

  it('CB-VEN-13 boleta de exactamente S/ 700.00 sin cliente es válida (condición total > 700 falsa)', () => {
    db.prepare('UPDATE productos SET precio_centimos = 70000, stock = 5 WHERE id = 2').run();
    const v = ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 2, cantidad: 1 }] });
    assert.equal(v.total_centimos, 70000);
  });

  it('CB-VEN-14 boleta de S/ 700.01 CON cliente es válida (condición !cliente falsa)', () => {
    db.prepare('UPDATE productos SET precio_centimos = 70001, stock = 5 WHERE id = 2').run();
    const v = ventas.registrar({ tipo_comprobante: 'BOLETA', cliente_id: 1, items: [{ producto_id: 2, cantidad: 1 }] });
    assert.equal(v.total_centimos, 70001);
  });
});

describe('Caja blanca: anular()', () => {
  it('CB-VEN-15 rama "ya anulada" (409) y rama normal que repone el stock', () => {
    const v = ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: 6, cantidad: 3 }] });
    assert.equal(stockDe(6), 0);
    const anulada = ventas.anular(v.id);
    assert.equal(anulada.estado, 'ANULADA');
    assert.equal(stockDe(6), 3);
    const e = capturar(() => ventas.anular(v.id));
    assert.equal(e.status, 409);
    assert.equal(stockDe(6), 3, 'una segunda anulación no debe reponer de nuevo');
  });
});
