'use strict';

const { AppError } = require('../errores');
const { validarProducto, aTexto, solesACentimos } = require('../shared/validaciones');
const { crearServicioCrud } = require('./crudServicio');

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
  return crearServicioCrud({
    repositorio,
    nombreEntidad: 'El producto',
    validar: validarProducto,
    normalizar,
    // El proveedor se verifica antes que el código duplicado (422 antes que 409)
    validacionExtra: (producto) => {
      if (!proveedoresRepositorio.obtener(producto.proveedor_id)) {
        throw AppError.validacion({ proveedor_id: 'El proveedor elegido no existe.' });
      }
    },
    buscarDuplicado: (producto) => repositorio.buscarPorCodigo(producto.codigo),
    errorDuplicado: (producto) =>
      AppError.conflicto('Ya existe un producto con ese código.', {
        codigo: `El código ${producto.codigo} ya está en uso.`,
      }),
    contarDependencias: (id) => repositorio.contarVentas(id),
    mensajeDependencias: (producto, ventas) =>
      `No se puede eliminar ${producto.nombre}: aparece en ${ventas} venta(s). ` +
      'El historial de ventas debe conservarse.',
    listar: ({ busqueda, soloStockBajo } = {}) =>
      repositorio.listar({ busqueda: aTexto(busqueda), soloStockBajo: Boolean(soloStockBajo) }),
  });
}

module.exports = { crearProductosServicio };
