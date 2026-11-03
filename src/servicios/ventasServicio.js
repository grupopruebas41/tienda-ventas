'use strict';

const { AppError } = require('../errores');
const { aTexto, validarEntero, LIMITES } = require('../shared/validaciones');
const {
  calcularTotales,
  agruparItems,
  calcularImporte,
  formatearComprobante,
  MONTO_BOLETA_IDENTIFICADA_CENTIMOS,
} = require('../dominio/calculos');
const { validarId } = require('./comun');

const SERIES = Object.freeze({ BOLETA: 'B001', FACTURA: 'F001' });

function conComprobante(venta) {
  return venta ? { ...venta, comprobante: formatearComprobante(venta.serie, venta.correlativo) } : venta;
}

/**
 * Registro y anulación de ventas.
 * @param {object} deps
 * @param {Function} deps.transaccion  ejecuta una función dentro de BEGIN/COMMIT
 */
function crearVentasServicio({ ventasRepositorio, productosRepositorio, clientesRepositorio, transaccion }) {
  /** Valida cada línea antes de tocar la base de datos. */
  function validarItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw AppError.validacion({ items: 'Agrega al menos un producto a la venta.' });
    }
    items.forEach((item, posicion) => {
      const linea = posicion + 1;
      const idProducto = Number(item && item.producto_id);
      if (!Number.isInteger(idProducto) || idProducto < 1) {
        throw AppError.validacion({ items: `Línea ${linea}: elige un producto.` });
      }
      const error = validarEntero(item.cantidad, 'La cantidad', LIMITES.CANTIDAD_MIN, LIMITES.CANTIDAD_MAX);
      if (error) throw AppError.validacion({ items: `Línea ${linea}: ${error}` });
    });
  }

  function obtenerCliente(clienteId) {
    if (clienteId === null || clienteId === undefined || aTexto(clienteId) === '') return null;
    const cliente = clientesRepositorio.obtener(Number(clienteId));
    if (!cliente) throw AppError.validacion({ cliente_id: 'El cliente elegido no existe.' });
    return cliente;
  }

  /** Busca cada producto, verifica stock y congela el precio vigente. */
  function prepararLineas(items) {
    return agruparItems(items).map(({ producto_id, cantidad }) => {
      const producto = productosRepositorio.obtener(producto_id);
      if (!producto) {
        throw AppError.validacion({ items: `El producto con id ${producto_id} no existe.` });
      }
      if (producto.stock < cantidad) {
        throw AppError.conflicto(
          `Stock insuficiente de ${producto.nombre}: pediste ${cantidad} y solo quedan ${producto.stock}.`,
          { items: `Stock disponible de ${producto.codigo}: ${producto.stock}.` }
        );
      }
      return {
        producto_id,
        cantidad,
        precioUnitarioCentimos: producto.precio_centimos,
        importeCentimos: calcularImporte(cantidad, producto.precio_centimos),
      };
    });
  }

  function verificarReglasComprobante(tipo, cliente, totalCentimos) {
    if (tipo === 'FACTURA' && (!cliente || cliente.tipo_documento !== 'RUC')) {
      throw AppError.validacion({ cliente_id: 'La factura requiere un cliente con RUC.' });
    }
    if (tipo === 'BOLETA' && totalCentimos > MONTO_BOLETA_IDENTIFICADA_CENTIMOS && !cliente) {
      throw AppError.validacion({
        cliente_id: 'Las boletas mayores a S/ 700.00 deben identificar al cliente (DNI o RUC).',
      });
    }
  }

  return {
    SERIES,

    listar() {
      return ventasRepositorio.listar().map(conComprobante);
    },

    obtener(id) {
      const venta = ventasRepositorio.obtener(validarId(id));
      if (!venta) throw AppError.noEncontrado('La venta');
      return conComprobante(venta);
    },

    registrar(datos) {
      const d = datos || {};
      const tipo = aTexto(d.tipo_comprobante).toUpperCase();
      if (!SERIES[tipo]) {
        throw AppError.validacion({ tipo_comprobante: 'Elige boleta o factura.' });
      }
      validarItems(d.items);
      const cliente = obtenerCliente(d.cliente_id);
      const lineas = prepararLineas(d.items);
      const totales = calcularTotales(lineas);
      verificarReglasComprobante(tipo, cliente, totales.totalCentimos);

      const ventaId = transaccion(() => {
        const serie = SERIES[tipo];
        const id = ventasRepositorio.crear({
          tipo_comprobante: tipo,
          serie,
          correlativo: ventasRepositorio.siguienteCorrelativo(serie),
          cliente_id: cliente ? cliente.id : null,
          subtotal_centimos: totales.subtotalCentimos,
          igv_centimos: totales.igvCentimos,
          total_centimos: totales.totalCentimos,
        });
        for (const linea of lineas) {
          if (!productosRepositorio.descontarStock(linea.producto_id, linea.cantidad)) {
            throw AppError.conflicto('El stock cambió mientras registrabas la venta. Inténtalo otra vez.');
          }
          ventasRepositorio.agregarDetalle(id, {
            producto_id: linea.producto_id,
            cantidad: linea.cantidad,
            precio_unitario_centimos: linea.precioUnitarioCentimos,
            importe_centimos: linea.importeCentimos,
          });
        }
        return id;
      });
      return this.obtener(ventaId);
    },

    anular(id) {
      const venta = this.obtener(id);
      if (venta.estado === 'ANULADA') {
        throw AppError.conflicto(`La venta ${venta.comprobante} ya estaba anulada.`);
      }
      transaccion(() => {
        for (const linea of venta.detalle) {
          productosRepositorio.devolverStock(linea.producto_id, linea.cantidad);
        }
        ventasRepositorio.marcarAnulada(venta.id);
      });
      return this.obtener(venta.id);
    },

    resumen() {
      return ventasRepositorio.resumen();
    },
  };
}

module.exports = { crearVentasServicio, SERIES };
