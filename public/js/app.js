import { vistaResumen } from './vistas/resumen.js';
import { vistaVentas } from './vistas/ventas.js';
import { vistaClientes, vistaProveedores, vistaProductos } from './vistas/entidades.js';
import { esc } from './ui.js';

/** Enrutador por hash (#/clientes): cada vista se monta en un contenedor nuevo. */
const VISTAS = {
  resumen: { montar: vistaResumen, titulo: 'Resumen' },
  ventas: { montar: vistaVentas, titulo: 'Ventas' },
  productos: { montar: vistaProductos, titulo: 'Productos' },
  clientes: { montar: vistaClientes, titulo: 'Clientes' },
  proveedores: { montar: vistaProveedores, titulo: 'Proveedores' },
};

async function navegar({ moverFoco = false } = {}) {
  // DEF-12: un hash que no es de ruta (como #contenido del enlace "Saltar al contenido") no cambia la sección
  if (location.hash && !location.hash.startsWith('#/')) return;
  const nombre = location.hash.replace('#/', '') || 'resumen';
  const vista = VISTAS[nombre] || VISTAS.resumen;
  const principal = document.getElementById('contenido');

  // DEF-01: al cambiar de sección se cierran los diálogos que hubieran quedado abiertos
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());

  document.querySelectorAll('#menu a').forEach((a) => {
    if (a.dataset.vista === nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${vista.titulo} · El Mantaro`;

  // Contenedor nuevo para que los eventos de la vista anterior no se acumulen
  const focoAlNavegar = document.activeElement;
  const contenedor = document.createElement('div');
  contenedor.dataset.vista = nombre;
  principal.replaceChildren(contenedor);
  try {
    await vista.montar(contenedor);
    const titulo = contenedor.querySelector('.vista__titulo');
    if (titulo) titulo.setAttribute('tabindex', '-1');
    // Solo se mueve el foco si la persona no lo movió mientras cargaba la sección
    const focoSinCambio = document.activeElement === focoAlNavegar || document.activeElement === document.body;
    if (moverFoco && focoSinCambio) {
      // DEF-16: el foco va al título y el lector de pantalla anuncia la nueva sección
      titulo?.focus();
      const conteo = contenedor.querySelector('[data-testid="conteo"]')?.textContent;
      window.Accesibilidad?.anunciar(`Sección ${vista.titulo}${conteo ? `, ${conteo}` : ''}.`);
    }
  } catch (error) {
    contenedor.innerHTML = `<div class="vacio"><strong>No se pudo abrir ${esc(vista.titulo)}.</strong>${esc(error.message)}</div>`;
  }
}

window.addEventListener('hashchange', () => navegar({ moverFoco: true }));
window.addEventListener('DOMContentLoaded', () => navegar());
