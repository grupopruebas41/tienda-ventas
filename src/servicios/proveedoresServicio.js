'use strict';

const { AppError } = require('../errores');
const { validarProveedor, aTexto } = require('../shared/validaciones');
const { validarId, textoOpcional } = require('./comun');

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
  function obtenerExistente(id) {
    const proveedor = repositorio.obtener(validarId(id));
    if (!proveedor) throw AppError.noEncontrado('El proveedor');
    return proveedor;
  }

  function validarYNormalizar(datos, idActual) {
    const { valido, errores } = validarProveedor(datos);
    if (!valido) throw AppError.validacion(errores);
    const proveedor = normalizar(datos);
    const duplicado = repositorio.buscarPorRuc(proveedor.ruc);
    if (duplicado && duplicado.id !== idActual) {
      throw AppError.conflicto('Ya existe un proveedor con ese RUC.', {
        ruc: `El RUC ${proveedor.ruc} ya está registrado.`,
      });
    }
    return proveedor;
  }

  return {
    listar(busqueda) {
      return repositorio.listar(aTexto(busqueda));
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
      const productos = repositorio.contarProductos(existente.id);
      if (productos > 0) {
        throw AppError.conflicto(
          `No se puede eliminar a ${existente.razon_social}: abastece ${productos} producto(s). ` +
            'Reasigna o elimina esos productos primero.'
        );
      }
      repositorio.eliminar(existente.id);
      return existente;
    },
  };
}

module.exports = { crearProveedoresServicio };
