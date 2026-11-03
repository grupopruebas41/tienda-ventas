'use strict';

/**
 * PRUEBAS UNITARIAS — src/dominio/calculos.js (IGV y totales de la venta)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../src/dominio/calculos');

describe('Unitarias: cálculos de la venta', () => {
  it('PU-CAL-01 calcularImporte multiplica cantidad por precio en céntimos', () => {
    assert.equal(C.calcularImporte(3, 450), 1350);
  });

  it('PU-CAL-02 calcularTotales separa la op. gravada y el IGV de un total con IGV incluido', () => {
    const t = C.calcularTotales([{ cantidad: 1, precioUnitarioCentimos: 11800 }]);
    assert.deepEqual(t, { subtotalCentimos: 10000, igvCentimos: 1800, totalCentimos: 11800 });
  });

  it('PU-CAL-03 la suma de op. gravada + IGV siempre es igual al total (redondeo)', () => {
    for (const precio of [1, 99, 350, 1690, 99999]) {
      const t = C.calcularTotales([{ cantidad: 7, precioUnitarioCentimos: precio }]);
      assert.equal(t.subtotalCentimos + t.igvCentimos, t.totalCentimos);
    }
  });

  it('PU-CAL-04 agruparItems suma cantidades del mismo producto', () => {
    const r = C.agruparItems([
      { producto_id: '1', cantidad: 2 },
      { producto_id: 2, cantidad: 1 },
      { producto_id: 1, cantidad: '3' },
    ]);
    assert.deepEqual(r, [
      { producto_id: 1, cantidad: 5 },
      { producto_id: 2, cantidad: 1 },
    ]);
  });

  it('PU-CAL-05 formatearComprobante rellena el correlativo con 8 dígitos', () => {
    assert.equal(C.formatearComprobante('B001', 25), 'B001-00000025');
  });

  it('PU-CAL-06 constantes de negocio: IGV 18 % y límite de boleta S/ 700', () => {
    assert.equal(C.TASA_IGV, 0.18);
    assert.equal(C.MONTO_BOLETA_IDENTIFICADA_CENTIMOS, 70000);
  });
});
