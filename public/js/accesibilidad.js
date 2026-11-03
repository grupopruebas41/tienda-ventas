/**
 * Accesibilidad — preferencias del usuario, anuncios para lectores de pantalla,
 * lectura en voz alta y atajos de teclado.
 *
 * Se carga como script clásico en <head> (sin defer) para aplicar las
 * preferencias guardadas ANTES de pintar la página: así una persona con baja
 * visión no ve un destello con el tamaño o el contraste normales.
 */
(function () {
  'use strict';

  const CLAVE = 'el-mantaro-accesibilidad';
  const POR_DEFECTO = { tamano: '100', contraste: false, espaciado: false, movimiento: false, voz: false };
  const raiz = document.documentElement;

  /* ---------------- Preferencias ---------------- */
  function leer() {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      return { ...POR_DEFECTO, ...guardadas };
    } catch {
      return { ...POR_DEFECTO };
    }
  }

  function guardar(prefs) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(prefs));
    } catch {
      /* modo privado: la preferencia vale solo para esta visita */
    }
  }

  function aplicar(prefs) {
    const atributo = (nombre, valor) => (valor ? raiz.setAttribute(nombre, valor) : raiz.removeAttribute(nombre));
    atributo('data-tamano', prefs.tamano !== '100' ? prefs.tamano : null);
    atributo('data-contraste', prefs.contraste ? 'alto' : null);
    atributo('data-espaciado', prefs.espaciado ? 'amplio' : null);
    atributo('data-movimiento', prefs.movimiento ? 'reducido' : null);
    atributo('data-voz', prefs.voz ? 'activa' : null);
  }

  let preferencias = leer();
  aplicar(preferencias);

  /* ---------------- Anuncios para lectores de pantalla ---------------- */
  function anunciar(texto, urgente) {
    const region = document.getElementById(urgente ? 'anunciador-urgente' : 'anunciador');
    if (!region) return;
    // Se vacía primero para que el lector repita un mensaje igual al anterior
    region.textContent = '';
    setTimeout(() => {
      region.textContent = texto;
    }, 60);
  }

  /* ---------------- Lectura en voz alta ---------------- */
  function hablar(texto) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined' || !texto) return false;
    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = 'es-PE';
    const voces = window.speechSynthesis.getVoices() || [];
    voz.voice = voces.find((v) => /^es[-_]PE/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang)) || null;
    voz.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(voz);
    return true;
  }

  /** Lee el título, la descripción y el resumen de la sección visible. */
  function leerPagina() {
    const vista = document.querySelector('#contenido [data-vista]');
    if (!vista) return false;
    const partes = [];
    const titulo = vista.querySelector('.vista__titulo');
    const descripcion = vista.querySelector('.vista__descripcion');
    const conteo = vista.querySelector('[data-testid="conteo"]');
    if (titulo) partes.push(titulo.textContent.trim());
    if (descripcion) partes.push(descripcion.textContent.trim());
    if (conteo && conteo.textContent.trim()) partes.push(`Hay ${conteo.textContent.trim()} en la lista.`);
    vista.querySelectorAll('.cifra').forEach((c) => partes.push(c.textContent.replace(/\s+/g, ' ').trim()));
    return hablar(partes.join('. '));
  }

  /** Lo usan los avisos: habla solo si la persona activó "Leer avisos en voz alta". */
  function hablarSiActivo(texto) {
    return preferencias.voz ? hablar(texto) : false;
  }

  /* ---------------- Panel de opciones ---------------- */
  function sincronizarPanel() {
    const radio = document.getElementById(`tamano-${preferencias.tamano}`);
    if (radio) radio.checked = true;
    ['contraste', 'espaciado', 'movimiento', 'voz'].forEach((clave) => {
      const casilla = document.getElementById(`pref-${clave}`);
      if (casilla) {
        casilla.checked = Boolean(preferencias[clave]);
        casilla.setAttribute('aria-checked', String(casilla.checked));
      }
    });
  }

  function cambiar(clave, valor) {
    preferencias = { ...preferencias, [clave]: valor };
    aplicar(preferencias);
    guardar(preferencias);
  }

  function abrirPanel() {
    const dialogo = document.getElementById('dialogo-accesibilidad');
    if (!dialogo || dialogo.open) return;
    sincronizarPanel();
    dialogo.showModal();
    const marcado = dialogo.querySelector('input[name="tamano"]:checked');
    (marcado || dialogo.querySelector('input')).focus();
  }

  function conectarPanel() {
    const dialogo = document.getElementById('dialogo-accesibilidad');
    if (!dialogo) return;
    document.getElementById('boton-accesibilidad').addEventListener('click', abrirPanel);

    dialogo.addEventListener('change', (e) => {
      const el = e.target;
      if (el.name === 'tamano') {
        cambiar('tamano', el.value);
        anunciar(`Tamaño de texto: ${el.nextElementSibling.textContent}.`);
      } else if (el.id && el.id.startsWith('pref-')) {
        const clave = el.id.slice(5);
        cambiar(clave, el.checked);
        el.setAttribute('aria-checked', String(el.checked));
        const nombre = el.closest('label').querySelector('strong').textContent;
        anunciar(`${nombre}: ${el.checked ? 'activado' : 'desactivado'}.`);
        if (clave === 'voz' && el.checked) hablar('Lectura en voz alta activada.');
      }
    });

    dialogo.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) dialogo.close();
      if (e.target.closest('#leer-pagina')) leerPagina();
      if (e.target.closest('#restablecer-preferencias')) {
        preferencias = { ...POR_DEFECTO };
        aplicar(preferencias);
        guardar(preferencias);
        sincronizarPanel();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        anunciar('Se restablecieron las opciones de accesibilidad.');
      }
    });
  }

  /* ---------------- Atajos de teclado (Alt + Mayús + tecla) ---------------- */
  const SECCIONES = ['resumen', 'ventas', 'productos', 'clientes', 'proveedores'];

  function alPresionarTecla(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    const vista = document.querySelector('#contenido [data-vista]');
    let manejado = true;
    if (/^Digit[1-5]$/.test(e.code)) {
      document.querySelectorAll('dialog[open]').forEach((d) => d.close());
      location.hash = `#/${SECCIONES[Number(e.code.slice(5)) - 1]}`;
    } else if (e.code === 'KeyN') {
      const boton = vista && vista.querySelector('[data-testid="boton-nuevo"], [data-testid="boton-nueva-venta"]');
      if (boton && !document.querySelector('dialog[open]')) boton.click();
      else manejado = false;
    } else if (e.code === 'KeyB') {
      const buscar = vista && vista.querySelector('[data-testid="buscar"]');
      if (buscar) buscar.focus();
      else manejado = false;
    } else if (e.code === 'KeyA') {
      abrirPanel();
    } else if (e.code === 'KeyL') {
      leerPagina();
    } else {
      manejado = false;
    }
    if (manejado) e.preventDefault();
  }

  /* ---------------- Enlace "Saltar al contenido" ---------------- */
  function conectarSalto() {
    // DEF-12: el enlace cambiaba el hash a #contenido y el enrutador mostraba "Resumen".
    const salto = document.querySelector('.saltar');
    if (!salto) return;
    salto.addEventListener('click', (e) => {
      e.preventDefault();
      const destino = document.querySelector('#contenido .vista__titulo') || document.getElementById('contenido');
      destino.focus();
    });
  }

  document.addEventListener('keydown', alPresionarTecla);
  document.addEventListener('DOMContentLoaded', () => {
    conectarPanel();
    conectarSalto();
  });

  window.Accesibilidad = { anunciar, hablar, hablarSiActivo, leerPagina, abrirPanel, preferencias: () => ({ ...preferencias }) };
})();
