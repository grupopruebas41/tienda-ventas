'use strict';

/**
 * PRUEBAS DE ACCESIBILIDAD (caja negra, E2E) — WCAG 2.2 nivel AA
 *
 * Verifican que personas con discapacidad visual, motriz, auditiva o cognitiva
 * puedan usar el sistema: solo con teclado, con lector de pantalla, con texto
 * grande, con alto contraste y con lectura en voz alta.
 * Cada caso indica el criterio WCAG que comprueba.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { iniciarServidor } = require('../helpers/servidor');
const { contraste } = require('../helpers/contraste');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const CARPETA_EVIDENCIAS = path.join(__dirname, '..', '..', 'docs', 'evidencias');
const guardarEvidencias = process.env.EVIDENCIAS === '1';
const VISTAS = ['resumen', 'ventas', 'productos', 'clientes', 'proveedores'];

/** Nombre accesible simplificado (aria-labelledby, aria-label, label, texto, title, alt). */
function nombresFaltantes() {
  const nombre = (el) => {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) return ids.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.id && document.querySelector(`label[for="${el.id}"]`)) return document.querySelector(`label[for="${el.id}"]`).textContent.trim();
    if (el.closest('label')) return el.closest('label').textContent.trim();
    return (el.textContent || el.getAttribute('title') || el.getAttribute('alt') || '').trim();
  };
  const visibles = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="switch"]')].filter((el) => {
    if (el.type === 'hidden') return false;
    const dialogo = el.closest('dialog');
    if (dialogo && !dialogo.open) return false;
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) || el.type === 'radio';
  });
  return visibles.filter((el) => nombre(el) === '').map((el) => el.outerHTML.slice(0, 90));
}

describe('Accesibilidad (WCAG 2.2 AA)', { skip: !chromium && 'Instala Playwright: npm install && npx playwright install chromium' }, () => {
  let srv;
  let navegador;
  let pagina;
  let contexto;

  async function evidencia(nombre) {
    if (!guardarEvidencias) return;
    await pagina.waitForTimeout(300);
    await pagina.screenshot({ path: path.join(CARPETA_EVIDENCIAS, `${nombre}.png`) });
  }

  async function ir(vista) {
    await pagina.goto(`${srv.url}/?t=${Date.now()}#/${vista}`);
    await pagina.waitForSelector(`[data-vista="${vista}"] .vista__titulo`);
  }

  const foco = () => pagina.evaluate(() => {
    const el = document.activeElement;
    return { id: el.id, texto: (el.textContent || '').trim().slice(0, 40), tag: el.tagName, testid: el.dataset.testid || '' };
  });

  before(async () => {
    srv = await iniciarServidor();
    navegador = await chromium.launch();
    contexto = await navegador.newContext({ viewport: { width: 1366, height: 820 } });
    // Doble de prueba de la síntesis de voz: registra lo que se leería en voz alta
    await contexto.addInitScript(() => {
      window.__leido = [];
      const falso = {
        speak: (u) => window.__leido.push(u.text),
        cancel: () => {},
        getVoices: () => [],
        speaking: false,
        addEventListener: () => {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: falso, configurable: true });
    });
    pagina = await contexto.newPage();
    pagina.setDefaultTimeout(8000);
    await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (ruta) => ruta.abort());
  });

  after(async () => {
    await navegador?.close();
    await srv?.cerrar();
  });

  /* ---------------- Lectores de pantalla ---------------- */

  it('A11Y-01 [4.1.2] todos los botones, enlaces y campos tienen nombre accesible', async () => {
    const faltantes = [];
    for (const vista of VISTAS) {
      await ir(vista);
      faltantes.push(...(await pagina.evaluate(nombresFaltantes)).map((f) => `${vista}: ${f}`));
    }
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    faltantes.push(...(await pagina.evaluate(nombresFaltantes)).map((f) => `form: ${f}`));
    await pagina.keyboard.press('Escape');
    await ir('ventas');
    await pagina.click('[data-testid="boton-nueva-venta"]');
    faltantes.push(...(await pagina.evaluate(nombresFaltantes)).map((f) => `venta: ${f}`));
    assert.deepEqual(faltantes, []);
  });

  it('A11Y-02 [1.3.1, 3.3.2] los campos obligatorios se anuncian como obligatorios', async () => {
    await ir('productos');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.waitForSelector('#dialogo-form[open] #campo-codigo');
    const sinRequired = await pagina.evaluate(() =>
      [...document.querySelectorAll('#form-campos .campo')]
        .filter((c) => !c.querySelector('.opcional'))
        .map((c) => c.querySelector('input, select'))
        .filter((ctrl) => ctrl.getAttribute('aria-required') !== 'true')
        .map((ctrl) => ctrl.id)
    );
    await pagina.keyboard.press('Escape');
    assert.deepEqual(sinRequired, []);
  });

  it('A11Y-03 [1.3.5] los campos de datos personales indican su propósito (autocomplete)', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    const valores = await pagina.evaluate(() =>
      ['campo-nombre', 'campo-email', 'campo-telefono', 'campo-direccion'].map((id) => document.getElementById(id).getAttribute('autocomplete'))
    );
    await pagina.keyboard.press('Escape');
    assert.deepEqual(valores, ['name', 'email', 'tel', 'street-address']);
  });

  it('A11Y-04 [3.3.1, 4.1.3] al enviar con errores se anuncia un resumen con enlaces a cada campo', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.click('#form-enviar');
    const resumen = pagina.locator('#form-resumen-errores');
    await resumen.waitFor({ state: 'visible' });
    assert.equal(await resumen.getAttribute('role'), 'alert');
    const enlaces = await resumen.locator('a').allTextContents();
    assert.ok(enlaces.length >= 2, `enlaces: ${enlaces}`);
    assert.equal(await pagina.getAttribute('#campo-numero_documento', 'aria-invalid'), 'true');
    assert.equal(await pagina.getAttribute('#campo-numero_documento', 'aria-describedby'), 'campo-numero_documento-error');
    await evidencia('a11y-03-resumen-errores');
    await resumen.locator('a').nth(1).click();
    assert.equal((await foco()).id, 'campo-nombre');
    await pagina.keyboard.press('Escape');
  });

  it('A11Y-05 [4.1.3] los avisos se anuncian: confirmaciones como estado y errores como alerta', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-numero_documento', '40001111');
    await pagina.fill('#campo-nombre', 'Gloria Mucha Pérez');
    await pagina.click('#form-enviar');
    await pagina.waitForFunction(() => /Cliente registrado/.test(document.getElementById('anunciador').textContent));
    await ir('proveedores');
    await pagina.locator('[data-testid="tabla-proveedores"] tbody tr', { hasText: 'Molinera' }).locator('[data-accion="eliminar"]').click();
    await pagina.click('#confirmar-aceptar');
    const aviso = pagina.locator('[data-testid="aviso-error"]');
    await aviso.waitFor();
    assert.equal(await aviso.locator('[role="alert"]').textContent(), await aviso.locator('.aviso__texto').textContent());
  });

  it('A11Y-06 [1.3.1] las tablas tienen título (caption) y encabezados de columna', async () => {
    for (const vista of ['ventas', 'productos', 'clientes', 'proveedores']) {
      await ir(vista);
      const r = await pagina.evaluate(() => {
        const t = document.querySelector('[data-vista] table');
        return { caption: t.querySelector('caption')?.textContent.trim() || '', scope: [...t.querySelectorAll('thead th')].every((th) => th.getAttribute('scope') === 'col') };
      });
      assert.ok(r.caption.length > 3, `${vista} sin caption`);
      assert.ok(r.scope, `${vista} sin scope`);
    }
  });

  it('A11Y-07 [2.4.3, 4.1.3] al cambiar de sección el foco va al título y se anuncia la sección', async () => {
    await ir('resumen');
    await pagina.click('#menu a[data-vista="clientes"]');
    await pagina.waitForSelector('[data-vista="clientes"] .vista__titulo');
    await pagina.waitForFunction(() => document.activeElement?.classList.contains('vista__titulo'));
    await pagina.waitForFunction(() => /Clientes/.test(document.getElementById('anunciador')?.textContent || ''));
  });

  /* ---------------- Teclado ---------------- */

  it('A11Y-08 [2.1.1] registrar un cliente usando solo el teclado', async () => {
    await ir('clientes');
    await pagina.keyboard.press('Tab'); // enlace "Saltar al contenido"
    assert.equal((await foco()).texto, 'Saltar al contenido');
    await pagina.keyboard.press('Enter');
    // Avanza con Tab hasta el botón "Nuevo cliente"
    for (let i = 0; i < 15 && (await foco()).testid !== 'boton-nuevo'; i++) await pagina.keyboard.press('Tab');
    assert.equal((await foco()).testid, 'boton-nuevo');
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#dialogo-form[open]');
    assert.equal((await foco()).id, 'campo-tipo_documento');
    await pagina.keyboard.press('Tab');
    await pagina.keyboard.type('46781234');
    await pagina.keyboard.press('Tab');
    await pagina.keyboard.type('Teodoro Rivera Quispe');
    await pagina.keyboard.press('Enter'); // envía el formulario
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("Cliente registrado.")');
  });

  it('A11Y-09 [2.4.3] al cerrar un diálogo el foco vuelve al botón que lo abrió', async () => {
    await ir('clientes');
    const editar = pagina.locator('[data-testid="tabla-clientes"] tbody tr', { hasText: 'Carlos Alberto' }).locator('[data-accion="editar"]');
    await editar.focus();
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#dialogo-form[open]');
    await pagina.keyboard.press('Escape');
    await pagina.waitForFunction(() => !document.querySelector('#dialogo-form').open);
    assert.match(await pagina.evaluate(() => document.activeElement.getAttribute('aria-label') || ''), /Editar Carlos Alberto/);

    const eliminar = pagina.locator('[data-testid="tabla-clientes"] tbody tr', { hasText: 'Carlos Alberto' }).locator('[data-accion="eliminar"]');
    await eliminar.focus();
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('#dialogo-confirmar[open]');
    await pagina.keyboard.press('Escape');
    assert.match(await pagina.evaluate(() => document.activeElement.getAttribute('aria-label') || ''), /Eliminar Carlos Alberto/);
  });

  it('A11Y-10 [2.1.1, 2.1.4] atajos de teclado: Alt+Shift+número, N (nuevo) y B (buscar)', async () => {
    await ir('resumen');
    await pagina.keyboard.press('Alt+Shift+Digit4');
    await pagina.waitForSelector('[data-vista="clientes"] .vista__titulo');
    await pagina.keyboard.press('Alt+Shift+KeyB');
    assert.equal((await foco()).testid, 'buscar');
    await pagina.keyboard.press('Alt+Shift+KeyN');
    await pagina.waitForSelector('#dialogo-form[open]');
    await pagina.keyboard.press('Escape');
  });

  it('A11Y-11 [2.4.7, 1.4.11] el foco es visible también en el modo de colores forzados de Windows', async () => {
    await pagina.emulateMedia({ forcedColors: 'active' });
    await ir('clientes');
    await pagina.focus('[data-testid="boton-nuevo"]');
    const estilo = await pagina.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return { outline: s.outlineStyle, ancho: parseFloat(s.outlineWidth) };
    });
    await pagina.emulateMedia({ forcedColors: 'none' });
    assert.notEqual(estilo.outline, 'none');
    assert.ok(estilo.ancho >= 2, `outline de ${estilo.ancho}px`);
  });

  /* ---------------- Tiempo y avisos ---------------- */

  it('A11Y-12 [2.2.1] los avisos de error no desaparecen solos y se pueden cerrar', async () => {
    await ir('proveedores');
    await pagina.locator('[data-testid="tabla-proveedores"] tbody tr', { hasText: 'Molinera' }).locator('[data-accion="eliminar"]').click();
    await pagina.click('#confirmar-aceptar');
    const aviso = pagina.locator('[data-testid="aviso-error"]').first();
    await aviso.waitFor();
    await pagina.waitForTimeout(7000);
    assert.equal(await aviso.isVisible(), true, 'el error desapareció solo');
    await aviso.getByRole('button', { name: /Cerrar aviso/ }).click();
    assert.equal(await pagina.locator('[data-testid="aviso-error"]').count(), 0);
  });

  /* ---------------- Panel de accesibilidad ---------------- */

  it('A11Y-13 [1.4.4, 1.4.10] texto al 150 %: todo se agranda y no aparece desplazamiento horizontal', async () => {
    await ir('productos');
    const antes = await pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('td')).fontSize));
    await pagina.click('#boton-accesibilidad');
    await pagina.waitForSelector('#dialogo-accesibilidad[open]');
    await evidencia('a11y-01-panel');
    await pagina.click('label[for="tamano-150"]');
    await pagina.keyboard.press('Escape');
    const despues = await pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('td')).fontSize));
    assert.ok(despues >= antes * 1.45, `${antes}px → ${despues}px`);
    for (const ancho of [1366, 640]) {
      await pagina.setViewportSize({ width: ancho, height: 820 });
      for (const vista of VISTAS) {
        await ir(vista);
        const sw = await pagina.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(sw <= ancho, `${vista} a ${ancho}px: ${sw}px`);
      }
    }
    await ir('productos');
    await evidencia('a11y-02-texto-grande');
    await pagina.setViewportSize({ width: 1366, height: 820 });
  });

  it('A11Y-14 [1.4.6] alto contraste: el texto alcanza al menos 7:1', async () => {
    await ir('clientes');
    await pagina.click('#boton-accesibilidad');
    await pagina.click('label[for="tamano-100"]');
    await pagina.locator('#pref-contraste').check();
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.getAttribute('html', 'data-contraste'), 'alto');
    await pagina.waitForTimeout(400); // deja terminar la transición de color de los botones
    const pares = await pagina.evaluate(() => {
      const fondoDe = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        }
        return 'rgb(255, 255, 255)';
      };
      return ['.vista__titulo', '.vista__descripcion', 'td', 'th', '.menu a', '.boton--primario', '.secundario']
        .map((s) => document.querySelector(s))
        .filter(Boolean)
        .map((el) => [el.className || el.tagName, getComputedStyle(el).color, fondoDe(el)]);
    });
    await evidencia('a11y-04-alto-contraste');
    for (const [nombre, color, fondo] of pares) {
      const r = contraste(color, fondo);
      assert.ok(r >= 7, `${nombre}: ${r.toFixed(2)}:1 (${color} sobre ${fondo})`);
    }
  });

  it('A11Y-15 las preferencias se recuerdan al volver a abrir el sistema', async () => {
    await ir('ventas');
    assert.equal(await pagina.getAttribute('html', 'data-contraste'), 'alto');
    await pagina.click('#boton-accesibilidad');
    await pagina.click('#restablecer-preferencias');
    await pagina.keyboard.press('Escape');
    await ir('ventas');
    assert.equal(await pagina.getAttribute('html', 'data-contraste'), null);
  });

  it('A11Y-16 [1.4.12] espaciado de texto amplio sin cortar contenido', async () => {
    await ir('ventas');
    await pagina.click('#boton-accesibilidad');
    await pagina.locator('#pref-espaciado').check();
    await pagina.keyboard.press('Escape');
    const r = await pagina.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.vista__descripcion'));
      return { lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize), ls: parseFloat(s.letterSpacing) / parseFloat(s.fontSize), ancho: document.documentElement.scrollWidth };
    });
    assert.ok(r.lh >= 1.5 && r.ls >= 0.12, JSON.stringify(r));
    assert.ok(r.ancho <= 1366);
    await pagina.click('#boton-accesibilidad');
    await pagina.locator('#pref-espaciado').uncheck();
    await pagina.keyboard.press('Escape');
  });

  it('A11Y-17 [2.3.3] reducir movimiento desactiva las animaciones', async () => {
    await ir('clientes');
    await pagina.click('#boton-accesibilidad');
    await pagina.locator('#pref-movimiento').check();
    await pagina.keyboard.press('Escape');
    await pagina.click('[data-testid="boton-nuevo"]');
    const anim = await pagina.evaluate(() => getComputedStyle(document.getElementById('dialogo-form')).animationName);
    await pagina.keyboard.press('Escape');
    assert.equal(anim, 'none');
  });

  it('A11Y-18 lectura en voz alta: lee la sección y los avisos para personas con baja visión', async () => {
    await ir('clientes');
    await pagina.click('#boton-accesibilidad');
    await pagina.locator('#pref-voz').check();
    await pagina.click('#leer-pagina');
    await pagina.keyboard.press('Escape');
    let leido = await pagina.evaluate(() => window.__leido.join(' | '));
    assert.match(leido, /Clientes/);
    assert.match(leido, /clientes/);
    await pagina.keyboard.press('Alt+Shift+KeyN');
    await pagina.fill('#campo-numero_documento', '41112222');
    await pagina.fill('#campo-nombre', 'Rosa Inés Pariona');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]');
    leido = await pagina.evaluate(() => window.__leido.join(' | '));
    assert.match(leido, /Cliente registrado/);
  });

  it('A11Y-19 [4.1.3] en la venta, el total se anuncia y el error de cantidad queda asociado al campo', async () => {
    await ir('ventas');
    await pagina.click('[data-testid="boton-nueva-venta"]');
    assert.equal(await pagina.getAttribute('#venta-total-anuncio', 'aria-live'), 'polite');
    const linea = pagina.locator('#venta-lineas tr').first();
    await linea.locator('select').selectOption({ index: 1 });
    await linea.locator('input').fill('9999');
    const input = linea.locator('input');
    assert.equal(await input.getAttribute('aria-invalid'), 'true');
    const idError = await input.getAttribute('aria-describedby');
    assert.match(await pagina.textContent(`#${idError}`), /Máx/);
    await pagina.keyboard.press('Escape');
  });

  it('A11Y-20 [2.5.8] los botones tienen un área táctil de al menos 24 × 24 px', async () => {
    const pequenos = [];
    for (const vista of ['clientes', 'ventas']) {
      await ir(vista);
      pequenos.push(
        ...(await pagina.evaluate(() =>
          [...document.querySelectorAll('button, a.boton, .menu a')]
            .filter((b) => b.offsetParent)
            .map((b) => [b.textContent.trim() || b.getAttribute('aria-label'), b.getBoundingClientRect()])
            .filter(([, r]) => r.width < 24 || r.height < 24)
            .map(([t, r]) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`)
        ))
      );
    }
    assert.deepEqual(pequenos, []);
  });

  it('A11Y-21 [1.4.10] regresión DEF-19: el panel de accesibilidad cabe en un celular con texto muy grande', async () => {
    await pagina.setViewportSize({ width: 390, height: 820 });
    await ir('clientes');
    await pagina.click('#boton-accesibilidad');
    await pagina.click('label[for="tamano-150"]');
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => {
      const d = document.getElementById('dialogo-accesibilidad').getBoundingClientRect();
      const fuera = [...document.querySelectorAll('#dialogo-accesibilidad label, #dialogo-accesibilidad button')]
        .filter((e) => e.getBoundingClientRect().right > d.right + 1)
        .map((e) => e.textContent.trim().slice(0, 30));
      return fuera;
    });
    await evidencia('a11y-05-panel-celular');
    await pagina.click('label[for="tamano-100"]');
    await pagina.keyboard.press('Escape');
    await pagina.setViewportSize({ width: 1366, height: 820 });
    assert.deepEqual(r, []);
  });
});

