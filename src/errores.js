'use strict';

/**
 * Error de aplicación con código HTTP. Los servicios lanzan AppError y el
 * manejador central lo traduce a una respuesta JSON clara para el usuario.
 */
class AppError extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.errores = errores || null;
  }

  static validacion(errores) {
    return new AppError(422, 'Revisa los campos marcados.', errores);
  }

  static noEncontrado(recurso) {
    return new AppError(404, `${recurso} no existe o ya fue eliminado.`);
  }

  static conflicto(mensaje, errores) {
    return new AppError(409, mensaje, errores);
  }

  static solicitudInvalida(mensaje) {
    return new AppError(400, mensaje);
  }
}

module.exports = { AppError };
