'use strict';

/** node:sqlite devuelve objetos sin prototipo; los convertimos en objetos normales. */
function plano(fila) {
  return fila ? { ...fila } : null;
}

function planos(filas) {
  return filas.map(plano);
}

/**
 * Patrón LIKE seguro: escapa % y _ para que el usuario busque texto literal.
 * Se compara contra normalizar(columna), por eso el patrón también va sin tildes.
 */
function patronBusqueda(texto) {
  const limpio = String(texto || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\\%_]/g, (c) => '\\' + c);
  return `%${limpio}%`;
}

module.exports = { plano, planos, patronBusqueda };
