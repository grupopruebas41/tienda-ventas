'use strict';

const { AppError } = require('../errores');
const { aTexto } = require('../shared/validaciones');

/** Convierte el :id de la URL en entero positivo o lanza 400. */
function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) {
    throw AppError.solicitudInvalida('El identificador debe ser un número entero positivo.');
  }
  return id;
}

/** Texto recortado; si queda vacío devuelve null (campos opcionales). */
function textoOpcional(valor) {
  const texto = aTexto(valor);
  return texto === '' ? null : texto;
}

module.exports = { validarId, textoOpcional };
