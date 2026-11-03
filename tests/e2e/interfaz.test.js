'use strict';

/**
 * PRUEBAS DE CAJA NEGRA DE EXTREMO A EXTREMO (E2E) — interfaz de usuario
 *
 * Un navegador real (Chromium, mediante la biblioteca Playwright) usa la
 * aplicación como lo haría el personal de la tienda: hace clic en BOTONES,
 * escribe en CUADROS DE TEXTO, elige en LISTAS y verifica cómo responde la
 * interfaz a cada EVENTO (click, input, change, submit).
 *
 * Requisito: npm install  y  npx playwright install chromium
 * Ejecutar:  npm run test:e2e
 * Con EVIDENCIAS=1 guarda capturas en docs/evidencias/.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { iniciarServidor } = require('../helpers/servidor');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const CARPETA_EVIDENCIAS = path.join(__dirname, '..', '..', 'docs', 'evidencias');
const guardarEvidencias = process.env.EVIDENCIAS === '1';

describe('E2E: interacción del usuario con la aplicación', { skip: !chromium && 'Instala Playwright: npm install && npx playwright install chromium' }, () => {
  let srv;
  let navegador;
  let pagina;

  async function evidencia(nombre) {
    if (!guardarEvidencias) return;
    await pagina.waitForTimeout(300); // espera a que termine la animación de los diálogos
    await pagina.screenshot({ path: path.join(CARPETA_EVIDENCIAS, `${nombre}.png`) });
  }

  /** Carga la vista desde cero (recarga completa) para que cada caso empiece limpio. */
  async function ir(vista) {
    await pagina.goto(`${srv.url}/?t=${Date.now()}#/${vista}`);
    await pagina.waitForSelector(`[data-vista="${vista}"] .vista__titulo`);
  }

  const fila = (tabla, texto) => pagina.locator(`[data-testid="tabla-${tabla}"] tbody tr`, { hasText: texto });

  before(async () => {
    srv = await iniciarServidor();
    navegador = await chromium.launch();
    pagina = await navegador.newPage({ viewport: { width: 1366, height: 820 } });
    // Sin internet las fuentes de Google no cargan; no afecta la prueba
    await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (ruta) => ruta.abort());
  });

  after(async () => {
    await navegador?.close();
    await srv?.cerrar();
  });

  it('E2E-01 el menú lateral navega entre las secciones y marca la activa', async () => {
    await ir('resumen');
    await evidencia('01-resumen');
    for (const vista of ['ventas', 'productos', 'clientes', 'proveedores']) {
      await pagina.click(`#menu a[data-vista="${vista}"]`);
      await pagina.waitForSelector(`[data-vista="${vista}"] .vista__titulo`);
      assert.equal(await pagina.getAttribute(`#menu a[data-vista="${vista}"]`, 'aria-current'), 'page');
    }
  });

  it('E2E-02 validación en tiempo real: los mensajes aparecen al escribir y desaparecen al corregir', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-numero_documento', '1234');
    await pagina.press('#campo-numero_documento', 'Tab');
    const error = pagina.locator('#campo-numero_documento-error');
    assert.equal(await error.textContent(), 'El DNI debe tener exactamente 8 dígitos.');
    await evidencia('02-validacion-tiempo-real');
    await pagina.fill('#campo-numero_documento', '41239876');
    assert.equal(await error.textContent(), '');
    await pagina.keyboard.press('Escape');
  });

  it('E2E-03 enviar el formulario vacío no llama al servidor y enfoca el primer error', async () => {
    await ir('clientes');
    let peticionesPost = 0;
    pagina.on('request', (r) => {
      if (r.method() === 'POST') peticionesPost++;
    });
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.click('#form-enviar');
    assert.equal(peticionesPost, 0);
    assert.equal(await pagina.evaluate(() => document.activeElement.id), 'campo-numero_documento');
    await pagina.click('#dialogo-form [data-cerrar].boton');
  });

  it('E2E-04 registrar cliente: aparece en la lista y se muestra el aviso de confirmación', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.selectOption('#campo-tipo_documento', 'DNI');
    await pagina.fill('#campo-numero_documento', '72345678');
    await pagina.fill('#campo-nombre', 'Lucía Fernanda Ñahui Cerrón');
    await pagina.fill('#campo-email', 'lucia.nahui@correo.pe');
    await pagina.fill('#campo-telefono', '964555123');
    await pagina.fill('#campo-direccion', 'Jr. Cusco 450, Huancayo');
    await evidencia('03-formulario-cliente-lleno');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]');
    assert.equal(await pagina.textContent('[data-testid="aviso-ok"] .aviso__texto'), 'Cliente registrado.');
    assert.equal(await fila('clientes', 'Ñahui').count(), 1);
    await evidencia('04-cliente-registrado');
  });

  it('E2E-05 al elegir RUC cambia la ayuda y el límite del cuadro de texto (evento change)', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.selectOption('#campo-tipo_documento', 'RUC');
    assert.equal(await pagina.getAttribute('#campo-numero_documento', 'maxlength'), '11');
    assert.match(await pagina.textContent('#campo-numero_documento-ayuda'), /11 dígitos/);
    await pagina.keyboard.press('Escape');
  });

  it('E2E-06 un documento duplicado muestra el error del servidor en el campo', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-numero_documento', '45678912');
    await pagina.fill('#campo-nombre', 'Persona Duplicada');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('#form-error-general:not([hidden])');
    assert.match(await pagina.textContent('#campo-numero_documento-error'), /ya está registrado/);
    await evidencia('05-error-duplicado');
    await pagina.keyboard.press('Escape');
  });

  it('E2E-07 la búsqueda filtra la lista mientras se escribe (evento input)', async () => {
    await ir('clientes');
    await pagina.fill('[data-testid="buscar"]', 'nahui');
    await pagina.waitForFunction(() => document.querySelectorAll('[data-testid="tabla-clientes"] tbody tr').length === 1);
    assert.equal(await pagina.textContent('[data-testid="conteo"]'), '1 cliente');
    await pagina.fill('[data-testid="buscar"]', 'zzzz');
    await pagina.waitForSelector('[data-testid="vacio"]');
    assert.match(await pagina.textContent('[data-testid="vacio"]'), /Sin resultados/);
  });

  it('E2E-08 editar cliente actualiza la fila', async () => {
    await ir('clientes');
    await fila('clientes', 'Ñahui').locator('[data-accion="editar"]').click();
    assert.equal(await pagina.inputValue('#campo-numero_documento'), '72345678');
    await pagina.fill('#campo-telefono', '987000111');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("Cliente actualizado.")');
    assert.match(await fila('clientes', 'Ñahui').textContent(), /987000111/);
  });

  it('E2E-09 eliminar pide confirmación: Cancelar conserva el registro, Eliminar lo quita', async () => {
    await ir('clientes');
    await fila('clientes', 'Ñahui').locator('[data-accion="eliminar"]').click();
    await pagina.waitForSelector('#dialogo-confirmar[open]');
    await evidencia('06-confirmar-eliminacion');
    await pagina.click('#confirmar-cancelar');
    assert.equal(await fila('clientes', 'Ñahui').count(), 1);

    await fila('clientes', 'Ñahui').locator('[data-accion="eliminar"]').click();
    await pagina.click('#confirmar-aceptar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("Cliente eliminado.")');
    assert.equal(await fila('clientes', 'Ñahui').count(), 0);
  });

  it('E2E-10 no se puede eliminar un proveedor con productos: se informa el motivo', async () => {
    await ir('proveedores');
    await fila('proveedores', 'Molinera Andina').locator('[data-accion="eliminar"]').click();
    await pagina.click('#confirmar-aceptar');
    await pagina.waitForSelector('[data-testid="aviso-error"]');
    assert.match(await pagina.textContent('[data-testid="aviso-error"] .aviso__texto'), /abastece 3 producto/);
    assert.equal(await fila('proveedores', 'Molinera Andina').count(), 1);
    await evidencia('07-proveedor-con-productos');
  });

  it('E2E-11 registrar proveedor y producto; el filtro "Solo stock bajo" lo muestra', async () => {
    await ir('proveedores');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-ruc', '20131456787');
    await pagina.fill('#campo-telefono', '964777888');
    await pagina.fill('#campo-razon_social', 'Cafetalera Selva Central S.A.C.');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("Proveedor registrado.")');

    await ir('productos');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-codigo', 'ABA-0050');
    await pagina.selectOption('#campo-categoria', 'Abarrotes');
    await pagina.fill('#campo-nombre', 'Café tostado de Chanchamayo 250 g');
    await pagina.fill('#campo-precio', '15.90');
    await pagina.selectOption('#campo-proveedor_id', { label: 'Cafetalera Selva Central S.A.C.' });
    await pagina.fill('#campo-stock', '2');
    await pagina.fill('#campo-stock_minimo', '5');
    await evidencia('08-formulario-producto');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("Producto registrado.")');

    await pagina.check('[data-testid="filtro-stock-bajo"]');
    await pagina.waitForFunction(() => !document.querySelector('[data-testid="tabla-productos"]')?.textContent.includes('Agua de manantial'));
    assert.match(await fila('productos', 'Chanchamayo').textContent(), /S\/ 15\.90.*2 · reponer/);
    await evidencia('09-filtro-stock-bajo');
  });

  it('E2E-12 nueva venta: totales en vivo, regla de factura y registro con descuento de stock', async () => {
    await ir('ventas');
    await pagina.click('[data-testid="boton-nueva-venta"]');
    await pagina.waitForSelector('#dialogo-venta[open]');
    const lineas = pagina.locator('#venta-lineas tr');

    await lineas.nth(0).locator('select').selectOption({ label: 'Queso andino fresco 500 g — S/ 16.90 (quedan 18)' });
    await lineas.nth(0).locator('input').fill('2');
    await pagina.click('#venta-agregar');
    await lineas.nth(1).locator('select').selectOption({ label: 'Leche fresca entera 1 L — S/ 4.50 (quedan 60)' });
    await lineas.nth(1).locator('input').fill('4');
    assert.equal(await pagina.textContent('[data-testid="venta-total"]'), 'S/ 51.80');
    assert.equal(await pagina.textContent('#venta-igv'), 'S/ 7.90');

    // Regla: factura sin RUC deshabilita el botón y muestra el motivo
    await pagina.click('label[for="tipo-factura"]');
    assert.equal(await pagina.isDisabled('[data-testid="venta-registrar"]'), true);
    assert.match(await pagina.textContent('#venta-regla'), /requiere un cliente con RUC/);
    await evidencia('10-regla-factura');

    // Cantidad mayor al stock marca la línea
    await lineas.nth(0).locator('input').fill('19');
    assert.equal(await lineas.nth(0).locator('[data-error]').textContent(), 'Máx. 18');
    await lineas.nth(0).locator('input').fill('2');

    await pagina.selectOption('[data-testid="venta-cliente"]', { label: 'Bodega Santa Rosa S.A.C. — RUC 20602233449' });
    assert.equal(await pagina.isDisabled('[data-testid="venta-registrar"]'), false);
    await evidencia('11-venta-lista');
    await pagina.click('[data-testid="venta-registrar"]');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("F001-00000002")');
    assert.equal(await fila('ventas', 'F001-00000002').count(), 1);
    await evidencia('12-venta-registrada');

    await ir('productos');
    assert.match(await fila('productos', 'Queso andino').textContent(), /16\b/);
  });

  it('E2E-13 anular venta desde el detalle repone el stock', async () => {
    await ir('ventas');
    await fila('ventas', 'F001-00000002').locator('[data-accion="ver"]').click();
    await pagina.waitForSelector('#dialogo-venta[open] .comprobante-meta');
    await evidencia('13-detalle-venta');
    await pagina.click('#dialogo-venta [data-anular]');
    await pagina.click('#confirmar-aceptar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]:has-text("anulada")');
    assert.match(await fila('ventas', 'F001-00000002').textContent(), /Anulada/);
    await ir('productos');
    assert.match(await fila('productos', 'Queso andino').textContent(), /18\b/);
  });

  it('E2E-14 seguridad: un nombre con HTML se muestra como texto (sin ejecutar script)', async () => {
    await ir('clientes');
    let alertas = 0;
    pagina.on('dialog', async (d) => {
      alertas++;
      await d.dismiss();
    });
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.fill('#campo-numero_documento', '70001122');
    await pagina.fill('#campo-nombre', '<img src=x onerror=alert(1)>');
    await pagina.click('#form-enviar');
    await pagina.waitForSelector('[data-testid="aviso-ok"]');
    await pagina.waitForTimeout(300);
    assert.equal(alertas, 0);
    assert.equal(await pagina.locator('[data-testid="tabla-clientes"] img').count(), 0);
    assert.equal(await fila('clientes', '<img src=x onerror=alert(1)>').count(), 1);
  });

  it('E2E-15 diseño responsivo: en celular (390 px) no hay desplazamiento horizontal', async () => {
    await pagina.setViewportSize({ width: 390, height: 800 });
    for (const vista of ['resumen', 'ventas', 'productos', 'clientes', 'proveedores']) {
      await ir(vista);
      const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(ancho <= 390, `${vista} mide ${ancho}px`);
    }
    await evidencia('14-vista-celular');
    await pagina.setViewportSize({ width: 1366, height: 820 });
  });

  it('E2E-16 regresión DEF-01: al cambiar de sección se cierra el formulario abierto', async () => {
    await ir('clientes');
    await pagina.click('[data-testid="boton-nuevo"]');
    await pagina.evaluate(() => {
      location.hash = '#/productos';
    });
    await pagina.waitForSelector('[data-vista="productos"] .vista__titulo');
    assert.equal(await pagina.locator('dialog[open]').count(), 0);
    await pagina.click('[data-testid="boton-nuevo"]'); // no queda bloqueado
    await pagina.waitForSelector('#dialogo-form[open]');
    await pagina.keyboard.press('Escape');
  });

  it('E2E-17 regresión DEF-09: el diálogo de venta no se desplaza con nombres largos', async () => {
    await ir('ventas');
    await pagina.click('[data-testid="boton-nueva-venta"]');
    await pagina.locator('#venta-lineas tr').nth(0).locator('select').selectOption({ index: 1 });
    await pagina.selectOption('[data-testid="venta-cliente"]', { index: 3 });
    const desborde = await pagina.evaluate(() => {
      const d = document.getElementById('dialogo-venta');
      return d.scrollWidth - d.clientWidth;
    });
    assert.ok(desborde <= 0, `el diálogo desborda ${desborde}px`);
    await pagina.keyboard.press('Escape');
  });
});
