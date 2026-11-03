'use strict';

const { AppError } = require('../errores');
const { validarProveedor, aTexto } = require('../shared/validaciones');
const { textoOpcional } = require('./comun');
const { crearServicioCrud } = require('./crudServicio');

function normalizar(datos) {
  return {
    ruc: aTexto(datos.ruc),
    razon_social: aTexto(datos.razon_social).replace(/\s+/g, ' '),
    contacto: textoOpcional(datos.contacto),
    telefono: aTexto(datos.telefono).replace(/\s+/g, ''),
    email: textoOpcional(datos.email) && aTexto(datos.email).toLowerCase(),
    direccion: textoOpcional(datos.direccion),
  };
}

function crearProveedoresServicio(repositorio) {
  return crearServicioCrud({
    repositorio,
    nombreEntidad: 'El proveedor',
    validar: validarProveedor,
    normalizar,
    buscarDuplicado: (proveedor) => repositorio.buscarPorRuc(proveedor.ruc),
    errorDuplicado: (proveedor) =>
      AppError.conflicto('Ya existe un proveedor con ese RUC.', {
        ruc: `El RUC ${proveedor.ruc} ya está registrado.`,
      }),
    contarDependencias: (id) => repositorio.contarProductos(id),
    mensajeDependencias: (proveedor, productos) =>
      `No se puede eliminar a ${proveedor.razon_social}: abastece ${productos} producto(s). ` +
      'Reasigna o elimina esos productos primero.',
  });
}

module.exports = { crearProveedoresServicio };
