/**
 * Componentes de interfaz reutilizables: avisos (toasts), diálogo de
 * confirmación, formulario modal con validación en tiempo real.
 */
const V = () => window.Validaciones;

export const esc = (valor) => V().escaparHtml(valor);
export const soles = (centimos) => V().formatearSoles(centimos);

const A11y = () => window.Accesibilidad || { anunciar() {}, hablarSiActivo() {} };

/* ---------------- Avisos ---------------- */
const DURACION_OK_MS = 8000;
const MAX_AVISOS = 3;

/**
 * Muestra un aviso.
 *  - Confirmaciones: se anuncian por la región #anunciador; se ocultan a los 8 s, pero el tiempo se pausa
 *    mientras el puntero o el foco están sobre el aviso (WCAG 2.2.1).
 *  - Errores: el texto tiene role="alert"; NO desaparecen solos (DEF-14), se cierran con el botón.
 */
export function avisar(mensaje, tipo = 'ok') {
  const contenedor = document.getElementById('avisos');
  const esError = tipo === 'error';
  const aviso = document.createElement('div');
  aviso.className = `aviso${esError ? ' aviso--error' : ''}`;
  aviso.dataset.testid = esError ? 'aviso-error' : 'aviso-ok';
  // Solo el texto del mensaje se anuncia (no el botón "✕"):
  //  - errores: role="alert" en el texto (se leen de inmediato)
  //  - confirmaciones: región de anuncios permanente (#anunciador), más confiable que un role="status" recién creado
  const texto = document.createElement('span');
  texto.className = 'aviso__texto';
  texto.textContent = mensaje;
  if (esError) texto.setAttribute('role', 'alert');
  else A11y().anunciar(mensaje);
  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'aviso__cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar aviso');
  cerrar.innerHTML = '<span aria-hidden="true">✕</span>';
  aviso.append(texto, cerrar);

  while (contenedor.children.length >= MAX_AVISOS) contenedor.firstElementChild.remove();
  contenedor.appendChild(aviso);
  A11y().hablarSiActivo(mensaje);

  let temporizador = null;
  const quitar = () => {
    clearTimeout(temporizador);
    aviso.remove();
  };
  const programar = () => {
    if (!esError) temporizador = setTimeout(quitar, DURACION_OK_MS);
  };
  const pausar = () => clearTimeout(temporizador);
  cerrar.addEventListener('click', quitar);
  aviso.addEventListener('mouseenter', pausar);
  aviso.addEventListener('focusin', pausar);
  aviso.addEventListener('mouseleave', programar);
  aviso.addEventListener('focusout', programar);
  programar();
}

/* ---------------- Confirmación ---------------- */
export function confirmar({ titulo, texto, accion = 'Eliminar' }) {
  const dialogo = document.getElementById('dialogo-confirmar');
  document.getElementById('confirmar-titulo').textContent = titulo;
  document.getElementById('confirmar-texto').textContent = texto;
  const aceptar = document.getElementById('confirmar-aceptar');
  const cancelar = document.getElementById('confirmar-cancelar');
  aceptar.textContent = accion;

  return new Promise((resolve) => {
    function terminar(valor) {
      aceptar.removeEventListener('click', alAceptar);
      cancelar.removeEventListener('click', alCancelar);
      dialogo.removeEventListener('cancel', alCancelar);
      dialogo.close();
      resolve(valor);
    }
    const alAceptar = () => terminar(true);
    const alCancelar = (e) => {
      e.preventDefault();
      terminar(false);
    };
    aceptar.addEventListener('click', alAceptar);
    cancelar.addEventListener('click', alCancelar);
    dialogo.addEventListener('cancel', alCancelar);
    dialogo.showModal();
    cancelar.focus();
  });
}

/* ---------------- Debounce para la búsqueda ---------------- */
export function retrasar(fn, ms = 250) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
}

/* ---------------- Formulario modal ---------------- */
function htmlCampo(c) {
  const id = `campo-${c.nombre}`;
  const opcional = c.requerido ? '' : ' <span class="opcional">(opcional)</span>';
  let control;
  if (c.tipo === 'select') {
    const opciones = c.opciones
      .map((o) => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`)
      .join('');
    control = `<select id="${id}" name="${c.nombre}"${c.requerido ? ' aria-required="true"' : ''}>${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}${opciones}</select>`;
  } else {
    const extra = [
      c.maxlength ? `maxlength="${c.maxlength}"` : '',
      c.inputmode ? `inputmode="${c.inputmode}"` : '',
      c.step ? `step="${c.step}"` : '',
      c.min !== undefined ? `min="${c.min}"` : '',
      c.placeholder ? `placeholder="${esc(c.placeholder)}"` : '',
      c.autocomplete ? `autocomplete="${c.autocomplete}"` : 'autocomplete="off"',
      c.requerido ? 'aria-required="true"' : '',
      c.ayuda ? `aria-describedby="${id}-ayuda"` : '',
    ].join(' ');
    control = `<input id="${id}" name="${c.nombre}" type="${c.tipo || 'text'}" ${extra} />`;
  }
  return `
    <div class="campo${c.completo ? ' campo--completo' : ''}" data-campo="${c.nombre}">
      <label for="${id}">${esc(c.etiqueta)}${opcional}</label>
      ${control}
      ${c.ayuda ? `<span class="campo__ayuda" id="${id}-ayuda">${esc(c.ayuda)}</span>` : ''}
      <span class="campo__error" id="${id}-error" aria-live="polite"></span>
    </div>`;
}

function leerFormulario(form, campos) {
  const datos = {};
  for (const c of campos) {
    datos[c.nombre] = form.elements[c.nombre].value;
  }
  return datos;
}

function pintarErrores(form, campos, errores, soloTocados, tocados) {
  for (const c of campos) {
    const contenedor = form.querySelector(`[data-campo="${c.nombre}"]`);
    const control = form.elements[c.nombre];
    const mensaje = errores[c.nombre] || '';
    const mostrar = !soloTocados || tocados.has(c.nombre);
    contenedor.querySelector('.campo__error').textContent = mostrar ? mensaje : '';
    contenedor.classList.toggle('campo--error', mostrar && Boolean(mensaje));
    contenedor.classList.toggle('campo--ok', mostrar && !mensaje && control.value.trim() !== '');
    control.setAttribute('aria-invalid', mostrar && mensaje ? 'true' : 'false');
    // Con error, el lector de pantalla lee el mensaje; sin error, la ayuda del campo
    if (mostrar && mensaje) control.setAttribute('aria-describedby', `campo-${c.nombre}-error`);
    else if (c.ayuda) control.setAttribute('aria-describedby', `campo-${c.nombre}-ayuda`);
    else control.removeAttribute('aria-describedby');
  }
}

/** Resumen de errores con enlaces a cada campo (WCAG 3.3.1). */
function pintarResumen(resumen, campos, errores) {
  const conError = campos.filter((c) => errores[c.nombre]);
  if (conError.length === 0) {
    resumen.hidden = true;
    resumen.innerHTML = '';
    return;
  }
  resumen.innerHTML = `
    <p>${conError.length === 1 ? 'Revisa 1 campo:' : `Revisa ${conError.length} campos:`}</p>
    <ul>${conError
      .map((c) => `<li><a href="#campo-${c.nombre}" data-ir-campo="campo-${c.nombre}">${esc(c.etiqueta)}: ${esc(errores[c.nombre])}</a></li>`)
      .join('')}</ul>`;
  resumen.hidden = false;
}

/**
 * Abre el formulario modal.
 * @param {object} cfg
 * @param {string} cfg.titulo
 * @param {Array} cfg.campos         definición de los campos
 * @param {object} [cfg.valores]     valores iniciales (edición)
 * @param {Function} cfg.validar     (datos) => { valido, errores }
 * @param {Function} cfg.guardar     async (datos) => respuesta
 * @param {Function} [cfg.alCambiar] (form, nombreCampo) => void  para reglas entre campos
 * @param {string} [cfg.textoBoton]
 */
export function abrirFormulario(cfg) {
  const dialogo = document.getElementById('dialogo-form');
  const form = document.getElementById('form-entidad');
  const contenedor = document.getElementById('form-campos');
  const errorGeneral = document.getElementById('form-error-general');
  const resumen = document.getElementById('form-resumen-errores');
  const botonEnviar = document.getElementById('form-enviar');

  document.getElementById('dialogo-form-titulo').textContent = cfg.titulo;
  botonEnviar.textContent = cfg.textoBoton || 'Guardar';
  contenedor.innerHTML = `<div class="rejilla">${cfg.campos.map(htmlCampo).join('')}</div>`;
  errorGeneral.hidden = true;
  resumen.hidden = true;
  resumen.innerHTML = '';

  const valores = cfg.valores || {};
  for (const c of cfg.campos) {
    const valor = valores[c.nombre];
    form.elements[c.nombre].value = valor === null || valor === undefined ? c.porDefecto ?? '' : valor;
  }
  if (cfg.alCambiar) cfg.alCambiar(form, null);

  const tocados = new Set();
  const validarAhora = (soloTocados) => {
    const resultado = cfg.validar(leerFormulario(form, cfg.campos));
    pintarErrores(form, cfg.campos, resultado.errores, soloTocados, tocados);
    if (resultado.valido) pintarResumen(resumen, cfg.campos, {});
    return resultado;
  };

  // Eventos: al escribir se valida en vivo; al salir del campo se marca como "tocado".
  const alEscribir = (e) => {
    const nombre = e.target.name;
    if (!nombre) return;
    if (e.type === 'change' || e.type === 'focusout') tocados.add(nombre);
    if (cfg.alCambiar) cfg.alCambiar(form, nombre);
    validarAhora(true);
  };

  const alEnviar = async (e) => {
    e.preventDefault();
    cfg.campos.forEach((c) => tocados.add(c.nombre));
    const { valido, errores } = validarAhora(false);
    if (!valido) {
      pintarResumen(resumen, cfg.campos, errores);
      form.querySelector('.campo--error input, .campo--error select')?.focus();
      return;
    }
    botonEnviar.disabled = true;
    botonEnviar.textContent = 'Guardando…';
    errorGeneral.hidden = true;
    try {
      const respuesta = await cfg.guardar(leerFormulario(form, cfg.campos));
      cerrar();
      avisar(respuesta.mensaje || 'Cambios guardados.');
    } catch (error) {
      if (error.errores) {
        pintarErrores(form, cfg.campos, error.errores, false, tocados);
        pintarResumen(resumen, cfg.campos, error.errores);
      }
      errorGeneral.textContent = error.message;
      errorGeneral.hidden = false;
      A11y().hablarSiActivo(error.message);
    } finally {
      botonEnviar.disabled = false;
      botonEnviar.textContent = cfg.textoBoton || 'Guardar';
    }
  };

  const alCerrarClick = (e) => {
    if (e.target.closest('[data-cerrar]')) cerrar();
    const enlace = e.target.closest('[data-ir-campo]');
    if (enlace) {
      e.preventDefault();
      document.getElementById(enlace.dataset.irCampo)?.focus();
    }
  };

  function cerrar() {
    form.removeEventListener('input', alEscribir);
    form.removeEventListener('change', alEscribir);
    form.removeEventListener('focusout', alEscribir);
    form.removeEventListener('submit', alEnviar);
    dialogo.removeEventListener('click', alCerrarClick);
    dialogo.removeEventListener('close', cerrar);
    if (dialogo.open) dialogo.close();
  }

  form.addEventListener('input', alEscribir);
  form.addEventListener('change', alEscribir);
  form.addEventListener('focusout', alEscribir);
  form.addEventListener('submit', alEnviar);
  dialogo.addEventListener('click', alCerrarClick);
  dialogo.addEventListener('close', cerrar);
  dialogo.showModal();
  form.querySelector('input, select')?.focus();
}

/* ---------------- Tabla con estado vacío ---------------- */
export function tablaHtml({ columnas, filas, vacio, testid, titulo }) {
  if (filas.length === 0) {
    return `<div class="tabla-contenedor"><div class="vacio" data-testid="vacio"><strong>${esc(vacio.titulo)}</strong>${esc(vacio.texto)}</div></div>`;
  }
  const cabecera = columnas
    .map((c) => `<th scope="col" class="${c.clase || ''}">${esc(c.titulo)}</th>`)
    .join('');
  const cuerpo = filas
    .map((f) => `<tr data-id="${f.id}">${columnas.map((c) => `<td class="${c.clase || ''}">${c.celda(f)}</td>`).join('')}</tr>`)
    .join('');
  const caption = `<caption class="solo-lectores">${esc(titulo || 'Lista')}, ${filas.length} ${filas.length === 1 ? 'fila' : 'filas'}</caption>`;
  return `<div class="tabla-contenedor"><table data-testid="${testid}">${caption}<thead><tr>${cabecera}</tr></thead><tbody>${cuerpo}</tbody></table></div>`;
}
