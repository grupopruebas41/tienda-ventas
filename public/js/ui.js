/**
 * Componentes de interfaz reutilizables: avisos (toasts), diálogo de
 * confirmación, formulario modal con validación en tiempo real.
 */
const V = () => window.Validaciones;

export const esc = (valor) => V().escaparHtml(valor);
export const soles = (centimos) => V().formatearSoles(centimos);

/* ---------------- Avisos ---------------- */
export function avisar(mensaje, tipo = 'ok') {
  const contenedor = document.getElementById('avisos');
  const aviso = document.createElement('div');
  aviso.className = `aviso${tipo === 'error' ? ' aviso--error' : ''}`;
  aviso.dataset.testid = tipo === 'error' ? 'aviso-error' : 'aviso-ok';
  aviso.textContent = mensaje;
  contenedor.appendChild(aviso);
  setTimeout(() => aviso.remove(), tipo === 'error' ? 6000 : 3500);
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
    control = `<select id="${id}" name="${c.nombre}">${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}${opciones}</select>`;
  } else {
    const extra = [
      c.maxlength ? `maxlength="${c.maxlength}"` : '',
      c.inputmode ? `inputmode="${c.inputmode}"` : '',
      c.step ? `step="${c.step}"` : '',
      c.min !== undefined ? `min="${c.min}"` : '',
      c.placeholder ? `placeholder="${esc(c.placeholder)}"` : '',
      c.autocomplete ? `autocomplete="${c.autocomplete}"` : 'autocomplete="off"',
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
    if (mostrar && mensaje) control.setAttribute('aria-describedby', `campo-${c.nombre}-error`);
  }
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
  const botonEnviar = document.getElementById('form-enviar');

  document.getElementById('dialogo-form-titulo').textContent = cfg.titulo;
  botonEnviar.textContent = cfg.textoBoton || 'Guardar';
  contenedor.innerHTML = `<div class="rejilla">${cfg.campos.map(htmlCampo).join('')}</div>`;
  errorGeneral.hidden = true;

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
    const { valido } = validarAhora(false);
    if (!valido) {
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
      if (error.errores) pintarErrores(form, cfg.campos, error.errores, false, tocados);
      errorGeneral.textContent = error.message;
      errorGeneral.hidden = false;
    } finally {
      botonEnviar.disabled = false;
      botonEnviar.textContent = cfg.textoBoton || 'Guardar';
    }
  };

  const alCerrarClick = (e) => {
    if (e.target.closest('[data-cerrar]')) cerrar();
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
export function tablaHtml({ columnas, filas, vacio, testid }) {
  if (filas.length === 0) {
    return `<div class="tabla-contenedor"><div class="vacio" data-testid="vacio"><strong>${esc(vacio.titulo)}</strong>${esc(vacio.texto)}</div></div>`;
  }
  const cabecera = columnas
    .map((c) => `<th scope="col" class="${c.clase || ''}">${esc(c.titulo)}</th>`)
    .join('');
  const cuerpo = filas
    .map((f) => `<tr data-id="${f.id}">${columnas.map((c) => `<td class="${c.clase || ''}">${c.celda(f)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="tabla-contenedor"><table data-testid="${testid}"><thead><tr>${cabecera}</tr></thead><tbody>${cuerpo}</tbody></table></div>`;
}
