'use strict';

/**
 * Cálculo de contraste según WCAG 2.2 (criterios 1.4.3 y 1.4.6).
 * ratio = (L1 + 0.05) / (L2 + 0.05), con L = luminancia relativa.
 *   ≥ 4.5 : texto normal nivel AA     ≥ 3 : texto grande y componentes (AA)
 *   ≥ 7   : texto normal nivel AAA
 */
function aRgb(color) {
  const c = String(color).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) return m[1].split(',').slice(0, 3).map((v) => Number(v.trim()));
  throw new Error(`Color no reconocido: ${color}`);
}

function luminancia(color) {
  const [r, g, b] = aRgb(color).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Lee las variables CSS de un bloque (por ejemplo ':root' o '[data-contraste="alto"]'). */
function leerVariables(css, selector) {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio === -1) throw new Error(`No existe el bloque ${selector}`);
  const bloque = css.slice(inicio, css.indexOf('}', inicio));
  const vars = {};
  for (const [, nombre, valor] of bloque.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[nombre] = valor.trim();
  return vars;
}

module.exports = { contraste, luminancia, leerVariables, aRgb };
