import { api } from '../api.js';
import { esc, avisar, confirmar, abrirFormulario, retrasar, tablaHtml } from '../ui.js';

/**
 * Construye una vista CRUD completa (listar, buscar, registrar, editar, eliminar)
 * a partir de una configuración. Clientes, proveedores y productos la reutilizan.
 */
export function crearVistaCrud(cfg) {
  return async function montar(contenedor) {
    const estado = { busqueda: '', filtros: {}, registros: [] };

    contenedor.innerHTML = `
      <header class="vista__cabecera">
        <div>
          <h1 class="vista__titulo">${esc(cfg.titulo)}</h1>
          <p class="vista__descripcion">${esc(cfg.descripcion)}</p>
        </div>
        <button type="button" class="boton boton--primario" data-accion="nuevo" data-testid="boton-nuevo">
          ${esc(cfg.botonNuevo)}
        </button>
      </header>
      <div class="barra">
        <label class="barra__busqueda">
          <span class="solo-lectores">Buscar</span>
          <input type="search" placeholder="${esc(cfg.placeholderBusqueda)}" data-testid="buscar" aria-label="Buscar ${esc(cfg.titulo.toLowerCase())}" />
        </label>
        ${(cfg.filtros || [])
          .map(
            (f) => `<label class="interruptor"><input type="checkbox" data-filtro="${f.nombre}" data-testid="filtro-${f.nombre}" /> ${esc(f.etiqueta)}</label>`
          )
          .join('')}
        <span class="barra__conteo" data-testid="conteo" aria-live="polite"></span>
      </div>
      <div data-zona="tabla"><p class="cargando">Cargando…</p></div>`;

    const zonaTabla = contenedor.querySelector('[data-zona="tabla"]');
    const conteo = contenedor.querySelector('[data-testid="conteo"]');

    async function cargar() {
      try {
        const { datos } = await api.listar(cfg.recurso, { q: estado.busqueda, ...estado.filtros });
        estado.registros = datos;
        conteo.textContent = `${datos.length} ${datos.length === 1 ? cfg.unidad[0] : cfg.unidad[1]}`;
        zonaTabla.innerHTML = tablaHtml({
          columnas: [
            ...cfg.columnas,
            {
              titulo: 'Acciones',
              clase: 'acciones',
              celda: (r) => `
                <button type="button" class="boton boton--texto" data-accion="editar" data-id="${r.id}" aria-label="Editar ${esc(cfg.etiqueta(r))}">Editar</button>
                <button type="button" class="boton boton--texto peligro" data-accion="eliminar" data-id="${r.id}" aria-label="Eliminar ${esc(cfg.etiqueta(r))}">Eliminar</button>`,
            },
          ],
          filas: datos,
          testid: `tabla-${cfg.recurso}`,
          titulo: `Lista de ${cfg.titulo.toLowerCase()}`,
          vacio: estado.busqueda
            ? { titulo: `Sin resultados para "${estado.busqueda}".`, texto: ' Prueba con otro nombre o documento.' }
            : cfg.vacio,
        });
      } catch (error) {
        zonaTabla.innerHTML = `<div class="tabla-contenedor"><div class="vacio"><strong>No se pudo cargar la lista.</strong>${esc(error.message)}</div></div>`;
      }
    }

    async function abrir(registro) {
      const campos = await cfg.campos();
      abrirFormulario({
        titulo: registro ? `Editar ${cfg.nombre}` : cfg.botonNuevo,
        textoBoton: registro ? 'Guardar cambios' : `Registrar ${cfg.nombre}`,
        campos,
        valores: registro ? (cfg.aFormulario ? cfg.aFormulario(registro) : registro) : {},
        validar: cfg.validar,
        alCambiar: cfg.alCambiar,
        guardar: async (datos) => {
          const respuesta = registro
            ? await api.actualizar(cfg.recurso, registro.id, datos)
            : await api.crear(cfg.recurso, datos);
          await cargar();
          return respuesta;
        },
      });
    }

    async function eliminar(registro) {
      const ok = await confirmar({
        titulo: `¿Eliminar ${cfg.nombre}?`,
        texto: `Se eliminará "${cfg.etiqueta(registro)}". Esta acción no se puede deshacer.`,
      });
      if (!ok) return;
      try {
        const respuesta = await api.eliminar(cfg.recurso, registro.id);
        avisar(respuesta.mensaje);
        await cargar();
      } catch (error) {
        avisar(error.message, 'error');
      }
    }

    // Eventos de la vista (delegación: un solo listener para todos los botones de la tabla)
    contenedor.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      const registro = estado.registros.find((r) => r.id === Number(boton.dataset.id));
      if (boton.dataset.accion === 'nuevo') abrir(null);
      if (boton.dataset.accion === 'editar' && registro) abrir(registro);
      if (boton.dataset.accion === 'eliminar' && registro) eliminar(registro);
    });

    const buscar = retrasar((texto) => {
      estado.busqueda = texto.trim();
      cargar();
    });
    contenedor.querySelector('[data-testid="buscar"]').addEventListener('input', (e) => buscar(e.target.value));

    contenedor.querySelectorAll('[data-filtro]').forEach((casilla) => {
      casilla.addEventListener('change', () => {
        const filtro = cfg.filtros.find((f) => f.nombre === casilla.dataset.filtro);
        if (casilla.checked) estado.filtros[filtro.parametro] = '1';
        else delete estado.filtros[filtro.parametro];
        cargar();
      });
    });

    await cargar();
  };
}
