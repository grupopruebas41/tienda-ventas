import { api } from '../api.js';
import { esc, soles, tablaHtml } from '../ui.js';

export async function vistaResumen(contenedor) {
  const [{ datos: r }, { datos: stockBajo }, { datos: ventas }] = await Promise.all([
    api.resumen(),
    api.listar('productos', { stockBajo: '1' }),
    api.listar('ventas'),
  ]);
  const hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  contenedor.innerHTML = `
    <header class="vista__cabecera">
      <div>
        <h1 class="vista__titulo">Resumen del día</h1>
        <p class="vista__descripcion">${esc(hoy.charAt(0).toUpperCase() + hoy.slice(1))}</p>
      </div>
      <a class="boton boton--primario" href="#/ventas" data-testid="ir-ventas">Registrar una venta</a>
    </header>

    <section class="cifras" aria-label="Cifras principales">
      <div class="cifra"><span class="cifra__valor" data-testid="vendido-hoy">${soles(r.vendido_hoy_centimos)}</span><span class="cifra__texto">vendido hoy</span></div>
      <div class="cifra"><span class="cifra__valor">${r.ventas}</span><span class="cifra__texto">ventas emitidas</span></div>
      <div class="cifra"><span class="cifra__valor">${r.productos}</span><span class="cifra__texto">productos en catálogo</span></div>
      <div class="cifra"><span class="cifra__valor">${r.clientes}</span><span class="cifra__texto">clientes registrados</span></div>
    </section>

    <div class="columnas">
      <section>
        <h2 class="bloque__titulo">Por reponer <a href="#/productos">Ver productos</a></h2>
        ${tablaHtml({
          testid: 'tabla-stock-bajo',
          titulo: 'Productos por reponer',
          filas: stockBajo,
          vacio: { titulo: 'Todo el stock está en orden.', texto: ' Ningún producto está por debajo de su mínimo.' },
          columnas: [
            { titulo: 'Producto', celda: (p) => `${esc(p.nombre)}<span class="secundario">${esc(p.proveedor)}</span>` },
            { titulo: 'Stock / mín.', clase: 'numero', celda: (p) => `<span class="etiqueta ${p.stock === 0 ? 'etiqueta--anulada' : 'etiqueta--alerta'}">${p.stock} / ${p.stock_minimo}</span>` },
          ],
        })}
      </section>
      <section>
        <h2 class="bloque__titulo">Últimas ventas <a href="#/ventas">Ver todas</a></h2>
        ${tablaHtml({
          testid: 'tabla-ultimas-ventas',
          titulo: 'Últimas ventas',
          filas: ventas.slice(0, 5),
          vacio: { titulo: 'Sin ventas todavía.', texto: ' La primera venta aparecerá aquí.' },
          columnas: [
            { titulo: 'Comprobante', celda: (v) => `<span class="doc">${esc(v.comprobante)}</span><span class="secundario">${v.cliente ? esc(v.cliente) : 'Cliente varios'}</span>` },
            { titulo: 'Total', clase: 'numero', celda: (v) => (v.estado === 'ANULADA' ? `<s>${soles(v.total_centimos)}</s>` : soles(v.total_centimos)) },
          ],
        })}
      </section>
    </div>`;
}
