'use strict';

const { AppError } = require('../errores');
const { validarCliente, aTexto } = require('../shared/validaciones');
const { validarId, textoOpcional } = require('./comun');

function normalizar(datos) {
  return {
    tipo_documento: aTexto(datos.tipo_documento),
    numero_documento: aTexto(datos.numero_documento),
    nombre: aTexto(datos.nombre).replace(/\s+/g, ' '),
    email: textoOpcional(datos.email) && aTexto(datos.email).toLowerCase(),
    telefono: textoOpcional(datos.telefono) && aTexto(datos.telefono).replace(/\s+/g, ''),
    direccion: textoOpcional(datos.direccion),
  };
}

/**
 * Reglas de negocio de clientes. Recibe el repositorio por parámetro
 * (inyección de dependencias) para poder reemplazarlo por un doble de
 * prueba en las pruebas unitarias.
 */
function crearClientesServicio(repositorio) {
  function obtenerExistente(id) {
    const cliente = repositorio.obtener(validarId(id));
    if (!cliente) throw AppError.noEncontrado('El cliente');
    return cliente;
  }

  function validarYNormalizar(datos, idActual) {
    const { valido, errores } = validarCliente(datos);
    if (!valido) throw AppError.validacion(errores);
    const cliente = normalizar(datos);
    const duplicado = repositorio.buscarPorDocumento(cliente.numero_documento);
    if (duplicado && duplicado.id !== idActual) {
      throw AppError.conflicto('Ya existe un cliente con ese documento.', {
        numero_documento: `El ${cliente.tipo_documento} ${cliente.numero_documento} ya está registrado.`,
      });
    }
    return cliente;
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
      const ventas = repositorio.contarVentas(existente.id);
      if (ventas > 0) {
        throw AppError.conflicto(
          `No se puede eliminar a ${existente.nombre}: tiene ${ventas} venta(s) registrada(s).`
        );
      }
      repositorio.eliminar(existente.id);
      return existente;
    },
  };
}

module.exports = { crearClientesServicio };
