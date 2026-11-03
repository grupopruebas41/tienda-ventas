'use strict';

/**
 * PRUEBAS DE CAJA BLANCA — validarRuc() y calcularDigitoRuc()
 *
 * Los casos se diseñaron a partir del CÓDIGO (grafo de flujo), no de la
 * especificación. Objetivo: recorrer cada camino independiente.
 *
 * validarRuc: 4 nodos predicado (D1..D4) → V(G) = 4 + 1 = 5 caminos
 *   D1: ruc === ''                 → camino 1
 *   D2: !/^\d{11}$/.test(ruc)       → camino 2
 *   D3: prefijo no permitido        → camino 3
 *   D4: dígito verificador ≠        → camino 4
 *   ninguno se cumple → null        → camino 5
 *
 * calcularDigitoRuc: bucle for + 2 if → V(G) = 3 + 1 = 4
 *   C1: resto === 10 → 0
 *   C2: resto === 11 → 1
 *   C3: resto entre 1 y 9 → resto
 *   C4: el bucle se ejecuta 10 veces (cubierto por C1..C3)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validarRuc, calcularDigitoRuc } = require('../../src/shared/validaciones');

describe('Caja blanca: validarRuc — caminos independientes', () => {
  it('CB-RUC-01 camino 1: D1 verdadero (vacío / null)', () => {
    assert.equal(validarRuc(''), 'El RUC es obligatorio.');
    assert.equal(validarRuc(null), 'El RUC es obligatorio.');
  });

  it('CB-RUC-02 camino 2: D1 falso, D2 verdadero (no son 11 dígitos)', () => {
    assert.equal(validarRuc('2060112233'), 'El RUC debe tener exactamente 11 dígitos.');
    assert.equal(validarRuc('2060112233A'), 'El RUC debe tener exactamente 11 dígitos.');
  });

  it('CB-RUC-03 camino 3: D3 verdadero (prefijo 30 no permitido)', () => {
    assert.equal(validarRuc('30601122333'), 'El RUC debe empezar con 10, 15, 16, 17 o 20.');
  });

  it('CB-RUC-04 camino 4: D4 verdadero (dígito verificador incorrecto)', () => {
    assert.match(validarRuc('20601122334'), /dígito verificador/);
  });

  it('CB-RUC-05 camino 5: todas las decisiones falsas → válido', () => {
    assert.equal(validarRuc('20601122333'), null);
  });
});

describe('Caja blanca: calcularDigitoRuc — ramas del resto', () => {
  it('CB-RUC-06 rama C1: resto 10 se convierte en dígito 0', () => {
    // suma = 2·5 + 1·2 = 12 → 12 % 11 = 1 → 11 − 1 = 10 → 0
    assert.equal(calcularDigitoRuc('2000000001'), 0);
    assert.equal(validarRuc('20000000010'), null);
  });

  it('CB-RUC-07 rama C2: resto 11 se convierte en dígito 1', () => {
    // suma = 2·5 + 6·2 = 22 → 22 % 11 = 0 → 11 − 0 = 11 → 1
    assert.equal(calcularDigitoRuc('2000000006'), 1);
    assert.equal(validarRuc('20000000061'), null);
  });

  it('CB-RUC-08 rama C3: resto normal (1..9) se devuelve tal cual', () => {
    // suma = 2·5 = 10 → 10 % 11 = 10 → 11 − 10 = 1
    assert.equal(calcularDigitoRuc('2000000000'), 1);
  });
});
