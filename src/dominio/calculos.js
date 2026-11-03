'use strict';

/**
 * Cálculos de una venta. Todos los importes se manejan en CÉNTIMOS (enteros)
 * para evitar los errores de redondeo de los números de coma flotante
 * (por ejemplo 0.1 + 0.2 = 0.30000000000000004).
 *
 * En el Perú los precios al público incluyen el IGV (18 %), por eso:
 *   total      = Σ (cantidad × precio unitario)
 *   op_gravada = total / 1.18   (redondeado al céntimo)
 *   igv        = total − op_gravada
 */
const TASA_IGV = 0.18;

/** Monto a partir del cual una boleta debe identificar al cliente (SUNAT): S/ 700.00 */
const MONTO_BOLETA_IDENTIFICADA_CENTIMOS = 70000;

function calcularImporte(cantidad, precioUnitarioCentimos) {
  return cantidad * precioUnitarioCentimos;
}

function calcularTotales(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { subtotalCentimos: 0, igvCentimos: 0, totalCentimos: 0 };
  }
  let totalCentimos = 0;
  for (const item of items) {
    totalCentimos += calcularImporte(item.cantidad, item.precioUnitarioCentimos);
  }
  const subtotalCentimos = Math.round(totalCentimos / (1 + TASA_IGV));
  const igvCentimos = totalCentimos - subtotalCentimos;
  return { subtotalCentimos, igvCentimos, totalCentimos };
}

/** Une líneas repetidas del mismo producto sumando sus cantidades. */
function agruparItems(items) {
  const porProducto = new Map();
  for (const item of items) {
    const id = Number(item.producto_id);
    const anterior = porProducto.get(id) || 0;
    porProducto.set(id, anterior + Number(item.cantidad));
  }
  return Array.from(porProducto, ([producto_id, cantidad]) => ({ producto_id, cantidad }));
}

/** Arma el número de comprobante: B001-00000025 */
function formatearComprobante(serie, correlativo) {
  return `${serie}-${String(correlativo).padStart(8, '0')}`;
}

module.exports = {
  TASA_IGV,
  MONTO_BOLETA_IDENTIFICADA_CENTIMOS,
  calcularImporte,
  calcularTotales,
  agruparItems,
  formatearComprobante,
};
