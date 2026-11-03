'use strict';

/**
 * PRUEBAS UNITARIAS — módulo src/shared/validaciones.js
 * Cada función se prueba de forma aislada (sin base de datos ni servidor).
 * Identificadores: PU-VAL-xx (se usan en el informe).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/shared/validaciones');

describe('Unitarias: validaciones de documentos peruanos', () => {
  it('PU-VAL-01 validarDni acepta 8 dígitos', () => {
    assert.equal(V.validarDni('45678912'), null);
  });

  it('PU-VAL-02 validarDni recorta espacios antes de validar', () => {
    assert.equal(V.validarDni('  45678912 '), null);
  });

  it('PU-VAL-03 validarDni rechaza vacío, 7 dígitos y letras', () => {
    assert.equal(V.validarDni(''), 'El DNI es obligatorio.');
    assert.match(V.validarDni('4567891'), /exactamente 8 dígitos/);
    assert.match(V.validarDni('4567891A'), /exactamente 8 dígitos/);
  });

  it('PU-VAL-04 validarRuc acepta un RUC con dígito verificador correcto', () => {
    assert.equal(V.validarRuc('20601122333'), null);
    assert.equal(V.validarRuc('10445566778'), null);
  });

  it('PU-VAL-05 calcularDigitoRuc devuelve el dígito esperado', () => {
    assert.equal(V.calcularDigitoRuc('2060112233'), 3);
  });
});

describe('Unitarias: contacto', () => {
  it('PU-VAL-06 validarEmail: opcional vacío es válido y obligatorio vacío no', () => {
    assert.equal(V.validarEmail('', false), null);
    assert.equal(V.validarEmail('', true), 'El correo es obligatorio.');
  });

  it('PU-VAL-07 validarEmail rechaza formatos incorrectos', () => {
    assert.equal(V.validarEmail('ventas@empresa.pe'), null);
    assert.ok(V.validarEmail('ventas@empresa'));
    assert.ok(V.validarEmail('ventas empresa.pe'));
    assert.ok(V.validarEmail('a'.repeat(95) + '@x.com'));
  });

  it('PU-VAL-08 validarTelefono acepta celular (9 dígitos con 9) y fijo (6-7 dígitos)', () => {
    assert.equal(V.validarTelefono('987654321'), null);
    assert.equal(V.validarTelefono('987 654 321'), null);
    assert.equal(V.validarTelefono('214567'), null);
    assert.equal(V.validarTelefono('4214567'), null);
  });

  it('PU-VAL-09 validarTelefono rechaza celular que no empieza en 9 y longitudes inválidas', () => {
    assert.ok(V.validarTelefono('887654321'));
    assert.ok(V.validarTelefono('12345'));
    assert.ok(V.validarTelefono('9876543210'));
    assert.equal(V.validarTelefono('', true), 'El teléfono es obligatorio.');
  });
});

describe('Unitarias: números y dinero', () => {
  it('PU-VAL-10 validarPrecio acepta límites 0.01 y 99999.99', () => {
    assert.equal(V.validarPrecio('0.01'), null);
    assert.equal(V.validarPrecio(99999.99), null);
  });

  it('PU-VAL-11 validarPrecio rechaza 0, negativos, > máximo, 3 decimales y texto', () => {
    assert.ok(V.validarPrecio('0'));
    assert.ok(V.validarPrecio('-5'));
    assert.ok(V.validarPrecio('100000'));
    assert.match(V.validarPrecio('1.234'), /2 decimales/);
    assert.match(V.validarPrecio('abc'), /número/);
    assert.match(V.validarPrecio(''), /obligatorio/);
  });

  it('PU-VAL-12 validarEntero rechaza decimales y valores fuera de rango', () => {
    assert.equal(V.validarEntero('0', 'El stock', 0, 10), null);
    assert.match(V.validarEntero('1.5', 'El stock', 0, 10), /entero/);
    assert.match(V.validarEntero('-1', 'El stock', 0, 10), /menor que 0/);
    assert.match(V.validarEntero('11', 'El stock', 0, 10), /mayor que 10/);
  });

  it('PU-VAL-13 solesACentimos evita errores de coma flotante', () => {
    assert.equal(V.solesACentimos('19.99'), 1999);
    assert.equal(V.solesACentimos(0.1 + 0.2), 30);
    assert.equal(V.centimosASoles(1250), 12.5);
  });

  it('PU-VAL-14 formatearSoles usa el formato S/ 1,234.50', () => {
    assert.equal(V.formatearSoles(123450), 'S/ 1,234.50');
    assert.equal(V.formatearSoles(5), 'S/ 0.05');
  });
});

describe('Unitarias: seguridad y entidades', () => {
  it('PU-VAL-15 escaparHtml neutraliza etiquetas (previene XSS)', () => {
    assert.equal(
      V.escaparHtml('<img src=x onerror="alert(1)">'),
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    assert.equal(V.escaparHtml(null), '');
  });

  it('PU-VAL-16 validarCliente devuelve todos los errores por campo', () => {
    const r = V.validarCliente({ tipo_documento: 'PASAPORTE', nombre: '' });
    assert.equal(r.valido, false);
    assert.deepEqual(Object.keys(r.errores).sort(), ['nombre', 'tipo_documento']);
  });

  it('PU-VAL-17 validarCliente con RUC usa la validación de RUC', () => {
    const r = V.validarCliente({ tipo_documento: 'RUC', numero_documento: '45678912', nombre: 'Bodega' });
    assert.match(r.errores.numero_documento, /11 dígitos/);
  });

  it('PU-VAL-18 validarProveedor exige RUC, razón social y teléfono', () => {
    const r = V.validarProveedor({});
    assert.deepEqual(Object.keys(r.errores).sort(), ['razon_social', 'ruc', 'telefono']);
  });

  it('PU-VAL-19 validarProducto acepta un producto completo', () => {
    const r = V.validarProducto({
      codigo: 'aba-0010',
      nombre: 'Arroz extra 5 kg',
      categoria: 'Abarrotes',
      precio: '24.90',
      stock: '10',
      stock_minimo: '3',
      proveedor_id: '2',
    });
    assert.deepEqual(r, { valido: true, errores: {} });
  });
});
