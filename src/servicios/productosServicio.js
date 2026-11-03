'use strict';

const { AppError } = require('../errores');
const { validarProducto, aTexto, solesACentimos } = require('../shared/validaciones');
const { validarId } = require('./comun');

function normalizar(datos) {
  return {
    codigo: aTexto(datos.codigo).toUpperCase(),
    nombre: aTexto(datos.nombre).replace(/\s+/g, ' '),
    categoria: aTexto(datos.categoria),
    precio_centimos: solesACentimos(datos.precio),
    stock: Number(datos.stock),
    stock_minimo: Number(datos.stock_minimo),
    proveedor_id: Number(datos.proveedor_id),
  };
}

function crearProductosServicio(repositorio, proveedoresRepositorio) {
  function obtenerExistente(id) {
    const producto = repositorio.obtener(validarId(id));
    if (!producto) throw AppError.noEncontrado('El producto');
    return producto;
  }

  function validarYNormalizar(datos, idActual) {
    const { valido, errores } = validarProducto(datos);
    if (!valido) throw AppError.validacion(errores);
    const producto = normalizar(datos);
    if (!proveedoresRepositorio.obtener(producto.proveedor_id)) {
      throw AppError.validacion({ proveedor_id: 'El proveedor elegido no existe.' });
    }
    const duplicado = repositorio.buscarPorCodigo(producto.codigo);
    if (duplicado && duplicado.id !== idActual) {
      throw AppError.conflicto('Ya existe un producto con ese código.', {
        codigo: `El código ${producto.codigo} ya está en uso.`,
      });
    }
    return producto;
  }

  return {
    listar({ busqueda, soloStockBajo } = {}) {
      return repositorio.listar({ busqueda: aTexto(busqueda), soloStockBajo: Boolean(soloStockBajo) });
    },

    obtener(id) {
      return obtenerExistente(id);
    },

    crear(datos) {
      return repositorio.crear(validarYNormalizar(datos || {}, null));
    },

    actualizar(id, datos) {
      const existente = obtenerExistente(id);
      return repositorio.actualizar(existente.id, validarYNormalizar(datos || {}, existente.id));
    },

    eliminar(id) {
      const existente = obtenerExistente(id);
      const ventas = repositorio.contarVentas(existente.id);
      if (ventas > 0) {
        throw AppError.conflicto(
          `No se puede eliminar ${existente.nombre}: aparece en ${ventas} venta(s). ` +
            'El historial de ventas debe conservarse.'
        );
      }
      repositorio.eliminar(existente.id);
      return existente;
    },
  };
}

module.exports = { crearProductosServicio };
