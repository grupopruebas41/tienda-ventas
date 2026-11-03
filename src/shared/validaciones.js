/**
 * Validaciones compartidas entre el backend (Node.js) y el frontend (navegador).
 *
 * Se escribe en formato UMD para que el MISMO código se use en ambos lados:
 *  - En Node.js se importa con require('./validaciones').
 *  - En el navegador se carga con <script src="/shared/validaciones.js"> y queda
 *    disponible como window.Validaciones.
 *
 * Así las reglas de negocio se prueban una sola vez (pruebas unitarias y de caja
 * blanca) y el usuario recibe exactamente los mismos mensajes al escribir en el
 * formulario que los que devolvería el servidor.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.Validaciones = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIMITES = Object.freeze({
    NOMBRE_MIN: 3,
    NOMBRE_MAX: 100,
    DIRECCION_MAX: 150,
    PRECIO_MIN: 0.01,
    PRECIO_MAX: 99999.99,
    STOCK_MIN: 0,
    STOCK_MAX: 99999,
    CANTIDAD_MIN: 1,
    CANTIDAD_MAX: 1000,
  });

  /** Prefijos de RUC válidos según SUNAT (10 persona natural, 20 persona jurídica, etc.). */
  const PREFIJOS_RUC = Object.freeze(['10', '15', '16', '17', '20']);

  /** Factores del algoritmo módulo 11 que SUNAT usa para el dígito verificador del RUC. */
  const FACTORES_RUC = Object.freeze([5, 4, 3, 2, 7, 6, 5, 4, 3, 2]);

  const CATEGORIAS = Object.freeze([
    'Abarrotes',
    'Bebidas',
    'Lácteos',
    'Limpieza',
    'Cuidado personal',
    'Otros',
  ]);

  function aTexto(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim();
  }

  function estaVacio(valor) {
    return aTexto(valor) === '';
  }

  /** Devuelve null si es válido o el mensaje de error. */
  function validarTexto(valor, etiqueta, min, max) {
    const texto = aTexto(valor);
    if (texto === '') return `${etiqueta} es obligatorio.`;
    if (texto.length < min) return `${etiqueta} debe tener al menos ${min} caracteres.`;
    if (texto.length > max) return `${etiqueta} admite como máximo ${max} caracteres.`;
    return null;
  }

  function validarDni(valor) {
    const dni = aTexto(valor);
    if (dni === '') return 'El DNI es obligatorio.';
    if (!/^\d{8}$/.test(dni)) return 'El DNI debe tener exactamente 8 dígitos.';
    return null;
  }

  /** Calcula el dígito verificador de los 10 primeros dígitos de un RUC. */
  function calcularDigitoRuc(diezDigitos) {
    let suma = 0;
    for (let i = 0; i < FACTORES_RUC.length; i++) {
      suma += Number(diezDigitos[i]) * FACTORES_RUC[i];
    }
    const resto = 11 - (suma % 11);
    if (resto === 10) return 0;
    if (resto === 11) return 1;
    return resto;
  }

  function validarRuc(valor) {
    const ruc = aTexto(valor);
    if (ruc === '') return 'El RUC es obligatorio.';
    if (!/^\d{11}$/.test(ruc)) return 'El RUC debe tener exactamente 11 dígitos.';
    if (!PREFIJOS_RUC.includes(ruc.slice(0, 2))) {
      return 'El RUC debe empezar con 10, 15, 16, 17 o 20.';
    }
    if (calcularDigitoRuc(ruc.slice(0, 10)) !== Number(ruc[10])) {
      return 'El RUC no es válido: el dígito verificador no coincide.';
    }
    return null;
  }

  function validarEmail(valor, obligatorio) {
    const email = aTexto(valor);
    if (email === '') return obligatorio ? 'El correo es obligatorio.' : null;
    if (email.length > 100) return 'El correo admite como máximo 100 caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return 'Escribe un correo válido, por ejemplo ventas@empresa.pe.';
    }
    return null;
  }

  /** Celular peruano (9 dígitos que inicia en 9) o teléfono fijo de 6 a 7 dígitos. */
  function validarTelefono(valor, obligatorio) {
    const telefono = aTexto(valor).replace(/\s+/g, '');
    if (telefono === '') return obligatorio ? 'El teléfono es obligatorio.' : null;
    if (!/^(9\d{8}|\d{6,7})$/.test(telefono)) {
      return 'Usa un celular de 9 dígitos que empiece en 9 o un fijo de 6 a 7 dígitos.';
    }
    return null;
  }

  function contarDecimales(numero) {
    const partes = String(numero).split('.');
    return partes.length === 2 ? partes[1].length : 0;
  }

  function validarPrecio(valor) {
    if (estaVacio(valor)) return 'El precio es obligatorio.';
    const precio = Number(valor);
    if (!Number.isFinite(precio)) return 'El precio debe ser un número.';
    if (precio < LIMITES.PRECIO_MIN) return 'El precio debe ser mayor que S/ 0.00.';
    if (precio > LIMITES.PRECIO_MAX) return 'El precio no puede superar S/ 99,999.99.';
    if (contarDecimales(aTexto(valor)) > 2) return 'El precio admite como máximo 2 decimales.';
    return null;
  }

  function validarEntero(valor, etiqueta, min, max) {
    if (estaVacio(valor)) return `${etiqueta} es obligatorio.`;
    const numero = Number(valor);
    if (!Number.isInteger(numero)) return `${etiqueta} debe ser un número entero.`;
    if (numero < min) return `${etiqueta} no puede ser menor que ${min}.`;
    if (numero > max) return `${etiqueta} no puede ser mayor que ${max}.`;
    return null;
  }

  /** Junta los errores no nulos en un objeto { campo: mensaje }. */
  function resultado(errores) {
    const limpios = {};
    Object.keys(errores).forEach(function (campo) {
      if (errores[campo]) limpios[campo] = errores[campo];
    });
    return { valido: Object.keys(limpios).length === 0, errores: limpios };
  }

  function validarCliente(datos) {
    const d = datos || {};
    const tipo = aTexto(d.tipo_documento);
    let errorDocumento;
    if (tipo === 'DNI') errorDocumento = validarDni(d.numero_documento);
    else if (tipo === 'RUC') errorDocumento = validarRuc(d.numero_documento);
    else errorDocumento = null;

    return resultado({
      tipo_documento: tipo === 'DNI' || tipo === 'RUC' ? null : 'Elige DNI o RUC.',
      numero_documento: errorDocumento,
      nombre: validarTexto(d.nombre, 'El nombre', LIMITES.NOMBRE_MIN, LIMITES.NOMBRE_MAX),
      email: validarEmail(d.email, false),
      telefono: validarTelefono(d.telefono, false),
      direccion:
        aTexto(d.direccion).length > LIMITES.DIRECCION_MAX
          ? `La dirección admite como máximo ${LIMITES.DIRECCION_MAX} caracteres.`
          : null,
    });
  }

  function validarProveedor(datos) {
    const d = datos || {};
    return resultado({
      ruc: validarRuc(d.ruc),
      razon_social: validarTexto(d.razon_social, 'La razón social', LIMITES.NOMBRE_MIN, LIMITES.NOMBRE_MAX),
      contacto: estaVacio(d.contacto)
        ? null
        : validarTexto(d.contacto, 'El contacto', LIMITES.NOMBRE_MIN, LIMITES.NOMBRE_MAX),
      telefono: validarTelefono(d.telefono, true),
      email: validarEmail(d.email, false),
      direccion:
        aTexto(d.direccion).length > LIMITES.DIRECCION_MAX
          ? `La dirección admite como máximo ${LIMITES.DIRECCION_MAX} caracteres.`
          : null,
    });
  }

  function validarProducto(datos) {
    const d = datos || {};
    const codigo = aTexto(d.codigo).toUpperCase();
    let errorCodigo = null;
    if (codigo === '') errorCodigo = 'El código es obligatorio.';
    else if (!/^[A-Z]{3}-\d{4}$/.test(codigo)) errorCodigo = 'El código debe tener el formato ABC-0001.';

    let errorProveedor = null;
    if (estaVacio(d.proveedor_id)) errorProveedor = 'Elige un proveedor.';
    else if (!Number.isInteger(Number(d.proveedor_id)) || Number(d.proveedor_id) < 1) {
      errorProveedor = 'El proveedor elegido no es válido.';
    }

    return resultado({
      codigo: errorCodigo,
      nombre: validarTexto(d.nombre, 'El nombre', LIMITES.NOMBRE_MIN, LIMITES.NOMBRE_MAX),
      categoria: CATEGORIAS.includes(aTexto(d.categoria)) ? null : 'Elige una categoría de la lista.',
      precio: validarPrecio(d.precio),
      stock: validarEntero(d.stock, 'El stock', LIMITES.STOCK_MIN, LIMITES.STOCK_MAX),
      stock_minimo: validarEntero(d.stock_minimo, 'El stock mínimo', LIMITES.STOCK_MIN, LIMITES.STOCK_MAX),
      proveedor_id: errorProveedor,
    });
  }

  /** Convierte soles (número o texto) a céntimos enteros para evitar errores de coma flotante. */
  function solesACentimos(soles) {
    return Math.round(Number(soles) * 100);
  }

  function centimosASoles(centimos) {
    return Math.round(Number(centimos)) / 100;
  }

  function formatearSoles(centimos) {
    const soles = centimosASoles(centimos);
    return (
      'S/ ' +
      soles.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }

  /** Evita XSS cuando el frontend pinta datos escritos por usuarios. */
  function escaparHtml(valor) {
    return aTexto(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    LIMITES,
    PREFIJOS_RUC,
    CATEGORIAS,
    aTexto,
    validarTexto,
    validarDni,
    calcularDigitoRuc,
    validarRuc,
    validarEmail,
    validarTelefono,
    validarPrecio,
    validarEntero,
    validarCliente,
    validarProveedor,
    validarProducto,
    solesACentimos,
    centimosASoles,
    formatearSoles,
    escaparHtml,
  };
});
