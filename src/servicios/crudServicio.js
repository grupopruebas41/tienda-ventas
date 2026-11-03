'use strict';

const { AppError } = require('../errores');
const { aTexto } = require('../shared/validaciones');
const { validarId } = require('./comun');

/**
 * Crea un servicio CRUD con las reglas comunes a clientes, proveedores y productos:
 * buscar por id (404), validar (422), normalizar, evitar duplicados (409) y no
 * eliminar registros que otros usan (409). Cada servicio solo declara lo propio.
 *
 * @param {object} config
 * @param {object} config.repositorio  Repositorio con obtener, listar, crear, actualizar y eliminar.
 * @param {string} config.nombreEntidad  Sujeto del mensaje 404, por ejemplo "El cliente".
 * @param {Function} config.validar  (datos) → { valido, errores }, de shared/validaciones.
 * @param {Function} config.normalizar  (datos) → entidad lista para guardar.
 * @param {Function} config.buscarDuplicado  (entidad) → registro con la misma clave única o undefined.
 * @param {Function} config.errorDuplicado  (entidad) → AppError 409 que se lanza si hay duplicado.
 * @param {Function} [config.validacionExtra]  (entidad) → lanza AppError si falla una regla propia.
 * @param {Function} config.contarDependencias  (id) → cantidad de registros que impiden eliminar.
 * @param {Function} config.mensajeDependencias  (existente, cantidad) → texto del 409 al eliminar.
 * @param {Function} [config.listar]  (filtros) → lista; por defecto busca por texto con repositorio.listar.
 * @returns {{listar: Function, obtener: Function, crear: Function, actualizar: Function, eliminar: Function}}
 */
function crearServicioCrud(config) {
  const { repositorio } = config;

  function obtenerExistente(id) {
    const registro = repositorio.obtener(validarId(id));
    if (!registro) throw AppError.noEncontrado(config.nombreEntidad);
    return registro;
  }

  function validarYNormalizar(datos, idActual) {
    const { valido, errores } = config.validar(datos);
    if (!valido) throw AppError.validacion(errores);
    const entidad = config.normalizar(datos);
    if (config.validacionExtra) config.validacionExtra(entidad);
    const duplicado = config.buscarDuplicado(entidad);
    if (duplicado && duplicado.id !== idActual) throw config.errorDuplicado(entidad);
    return entidad;
  }

  return {
    listar: config.listar || ((busqueda) => repositorio.listar(aTexto(busqueda))),

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
      const cantidad = config.contarDependencias(existente.id);
      if (cantidad > 0) throw AppError.conflicto(config.mensajeDependencias(existente, cantidad));
      repositorio.eliminar(existente.id);
      return existente;
    },
  };
}

module.exports = { crearServicioCrud };
