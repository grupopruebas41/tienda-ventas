'use strict';

const { AppError } = require('../errores');
const { validarCliente, aTexto } = require('../shared/validaciones');
const { textoOpcional } = require('./comun');
const { crearServicioCrud } = require('./crudServicio');

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
  return crearServicioCrud({
    repositorio,
    nombreEntidad: 'El cliente',
    validar: validarCliente,
    normalizar,
    buscarDuplicado: (cliente) => repositorio.buscarPorDocumento(cliente.numero_documento),
    errorDuplicado: (cliente) =>
      AppError.conflicto('Ya existe un cliente con ese documento.', {
        numero_documento: `El ${cliente.tipo_documento} ${cliente.numero_documento} ya está registrado.`,
      }),
    contarDependencias: (id) => repositorio.contarVentas(id),
    mensajeDependencias: (cliente, ventas) =>
      `No se puede eliminar a ${cliente.nombre}: tiene ${ventas} venta(s) registrada(s).`,
  });
}

module.exports = { crearClientesServicio };
