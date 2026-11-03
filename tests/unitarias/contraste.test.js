'use strict';

/**
 * PRUEBAS UNITARIAS (estáticas) DE ACCESIBILIDAD — contraste de la paleta
 * Lee las variables de color de public/css/styles.css y verifica las parejas
 * texto/fondo que realmente se usan en la interfaz (WCAG 2.2: 1.4.3, 1.4.6, 1.4.11).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { contraste, leerVariables } = require('../helpers/contraste');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const normal = leerVariables(css, ':root');
const alto = { ...normal, ...leerVariables(css, ':root[data-contraste="alto"]') };

// [texto, fondo, dónde se usa]
const PAREJAS_TEXTO = [
  ['tinta', 'blanco', 'texto principal en tablas y formularios'],
  ['tinta', 'lana', 'texto sobre el fondo de la página'],
  ['gris', 'blanco', 'textos secundarios y ayudas'],
  ['gris', 'lana', 'descripción de cada sección'],
  ['blanco', 'cochinilla', 'botón principal'],
  ['blanco', 'rojo', 'botón eliminar'],
  ['rojo', 'blanco', 'mensajes de error'],
  ['rojo', 'rojo-tenue', 'etiqueta "Agotado" / "Anulada"'],
  ['musgo', 'musgo-tenue', 'etiqueta de stock suficiente / "Emitida"'],
  ['maiz-texto', 'maiz-tenue', 'etiqueta "reponer"'],
  ['indigo-2', 'indigo-claro', 'etiqueta DNI / RUC'],
  ['lateral-texto', 'indigo', 'menú lateral'],
  ['lateral-tenue', 'indigo', 'pie del menú lateral'],
  ['cochinilla', 'blanco', 'enlaces "Ver todas"'],
];

// Componentes de interfaz: bordes de cuadros de texto y foco (mínimo 3:1)
const PAREJAS_COMPONENTES = [
  ['borde-control', 'blanco', 'borde de cuadros de texto y listas'],
  ['foco', 'blanco', 'indicador de foco del teclado'],
];

describe('Unitarias de accesibilidad: contraste de la paleta normal (AA)', () => {
  PAREJAS_TEXTO.forEach(([texto, fondo, uso], i) => {
    it(`PU-A11Y-${String(i + 1).padStart(2, '0')} ${uso}: ${texto} sobre ${fondo} ≥ 4.5:1`, () => {
      const r = contraste(normal[texto], normal[fondo]);
      assert.ok(r >= 4.5, `${r.toFixed(2)}:1`);
    });
  });
  PAREJAS_COMPONENTES.forEach(([texto, fondo, uso], i) => {
    it(`PU-A11Y-${String(PAREJAS_TEXTO.length + i + 1).padStart(2, '0')} ${uso}: ${texto} sobre ${fondo} ≥ 3:1`, () => {
      const r = contraste(normal[texto], normal[fondo]);
      assert.ok(r >= 3, `${r.toFixed(2)}:1`);
    });
  });
});

describe('Unitarias de accesibilidad: modo de alto contraste (AAA)', () => {
  it('PU-A11Y-17 todas las parejas de texto alcanzan 7:1 en alto contraste', () => {
    const fallas = PAREJAS_TEXTO.map(([t, f, uso]) => [uso, contraste(alto[t], alto[f])]).filter(([, r]) => r < 7);
    assert.deepEqual(fallas.map(([u, r]) => `${u} ${r.toFixed(2)}`), []);
  });

  it('PU-A11Y-18 bordes y foco alcanzan 4.5:1 en alto contraste', () => {
    for (const [t, f, uso] of PAREJAS_COMPONENTES) {
      assert.ok(contraste(alto[t], alto[f]) >= 4.5, uso);
    }
  });
});
