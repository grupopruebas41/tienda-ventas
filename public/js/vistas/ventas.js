import { api } from '../api.js';
import { esc, soles, avisar, confirmar, tablaHtml } from '../ui.js';

const LIMITE_BOLETA_CENTIMOS = 70000; // S/ 700.00
const TASA_IGV = 0.18;

function etiquetaEstado(v) {
  return v.estado === 'ANULADA'
    ? '<span class="etiqueta etiqueta--anulada">Anulada</span>'
    : '<span class="etiqueta etiqueta--ok">Emitida</span>';
}

function formatearFecha(texto) {
  const [fecha, hora] = String(texto).split(' ');
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}<span class="secundario">${(hora || '').slice(0, 5)}</span>`;
}

/** Mismo cálculo que el servidor (src/dominio/calculos.js). */
export function calcularTotales(lineas) {
  const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precio, 0);
  const subtotal = Math.round(total / (1 + TASA_IGV));
  return { total, subtotal, igv: total - subtotal };
}

export async function vistaVentas(contenedor) {
  const estado = { ventas: [] };
  contenedor.innerHTML = `
    <header class="vista__cabecera">
      <div>
        <h1 class="vista__titulo">Ventas</h1>
        <p class="vista__descripcion">Boletas y facturas emitidas. Al registrar una venta se descuenta el stock; al anularla, se repone.</p>
      </div>
      <button type="button" class="boton boton--primario" data-accion="nueva" data-testid="boton-nueva-venta">Nueva venta</button>
    </header>
    <div data-zona="tabla"><p class="cargando">Cargando…</p></div>`;
  const zona = contenedor.querySelector('[data-zona="tabla"]');

  async function cargar() {
    const { datos } = await api.listar('ventas');
    estado.ventas = datos;
    zona.innerHTML = tablaHtml({
      testid: 'tabla-ventas',
      titulo: 'Ventas registradas',
      filas: datos,
      vacio: { titulo: 'Todavía no hay ventas.', texto: ' Registra la primera con "Nueva venta".' },
      columnas: [
        { titulo: 'Comprobante', celda: (v) => `<span class="doc">${esc(v.comprobante)}</span><span class="secundario">${v.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta'}</span>` },
        { titulo: 'Fecha', clase: 'ocultar-movil', celda: (v) => formatearFecha(v.fecha) },
        { titulo: 'Cliente', celda: (v) => (v.cliente ? `${esc(v.cliente)}<span class="secundario">${esc(v.tipo_documento)} ${esc(v.numero_documento)}</span>` : '<span class="secundario">Cliente varios</span>') },
        { titulo: 'Total', clase: 'numero', celda: (v) => soles(v.total_centimos) },
        { titulo: 'Estado', celda: etiquetaEstado },
        {
          titulo: 'Acciones',
          clase: 'acciones',
          celda: (v) => `
            <button type="button" class="boton boton--texto" data-accion="ver" data-id="${v.id}">Ver</button>
            ${v.estado === 'EMITIDA' ? `<button type="button" class="boton boton--texto peligro" data-accion="anular" data-id="${v.id}">Anular</button>` : ''}`,
        },
      ],
    });
  }

  async function anular(venta) {
    const ok = await confirmar({
      titulo: `¿Anular ${venta.comprobante}?`,
      texto: `El total de ${soles(venta.total_centimos).replace(/\s/, ' ')} dejará de contarse y el stock se repondrá.`,
      accion: 'Anular venta',
    });
    if (!ok) return false;
    try {
      const r = await api.anularVenta(venta.id);
      avisar(r.mensaje);
      await cargar();
      return true;
    } catch (error) {
      avisar(error.message, 'error');
      return false;
    }
  }

  contenedor.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const venta = estado.ventas.find((v) => v.id === Number(boton.dataset.id));
    if (boton.dataset.accion === 'nueva') abrirNuevaVenta(cargar);
    if (boton.dataset.accion === 'ver' && venta) verVenta(venta.id, anular);
    if (boton.dataset.accion === 'anular' && venta) anular(venta);
  });

  await cargar();
}

/* ======================= Detalle de venta ======================= */
async function verVenta(id, anular) {
  const dialogo = document.getElementById('dialogo-venta');
  const { datos: v } = await api.obtener('ventas', id);
  dialogo.innerHTML = `
    <header class="dialogo__cabecera">
      <h2 id="venta-titulo">${v.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta'} ${esc(v.comprobante)}</h2>
      <button type="button" class="boton-icono" data-cerrar aria-label="Cerrar">✕</button>
    </header>
    <div class="dialogo__cuerpo">
      <dl class="comprobante-meta">
        <div><dt>Cliente</dt><dd>${v.cliente ? esc(v.cliente) : 'Cliente varios'}</dd></div>
        <div><dt>Documento</dt><dd>${v.cliente ? `${esc(v.tipo_documento)} ${esc(v.numero_documento)}` : '—'}</dd></div>
        <div><dt>Estado</dt><dd>${etiquetaEstado(v)}</dd></div>
      </dl>
      <div class="tabla-contenedor">
        <table>
          <thead><tr><th>Producto</th><th class="numero">Cant.</th><th class="numero">P. unit.</th><th class="numero">Importe</th></tr></thead>
          <tbody>${v.detalle
            .map(
              (d) => `<tr><td>${esc(d.nombre)}<span class="secundario">${esc(d.codigo)}</span></td><td class="numero">${d.cantidad}</td><td class="numero">${soles(d.precio_unitario_centimos)}</td><td class="numero">${soles(d.importe_centimos)}</td></tr>`
            )
            .join('')}</tbody>
        </table>
      </div>
      <div class="totales">
        <div><span>Op. gravada</span><span>${soles(v.subtotal_centimos)}</span></div>
        <div><span>IGV 18 %</span><span>${soles(v.igv_centimos)}</span></div>
        <div class="total"><span>Total</span><span>${soles(v.total_centimos)}</span></div>
      </div>
    </div>
    <footer class="dialogo__pie">
      ${v.estado === 'EMITIDA' ? '<button type="button" class="boton boton--secundario" data-anular>Anular venta</button>' : ''}
      <button type="button" class="boton boton--primario" data-cerrar>Cerrar</button>
    </footer>`;
  dialogo.onclick = async (e) => {
    if (e.target.closest('[data-cerrar]')) dialogo.close();
    if (e.target.closest('[data-anular]')) {
      dialogo.close();
      await anular(v);
    }
  };
  dialogo.showModal();
}

/* ======================= Registro de venta ======================= */
async function abrirNuevaVenta(alGuardar) {
  const dialogo = document.getElementById('dialogo-venta');
  const [{ datos: clientes }, { datos: productos }] = await Promise.all([
    api.listar('clientes'),
    api.listar('productos'),
  ]);
  const disponibles = productos.filter((p) => p.stock > 0);
  const lineas = [{ producto_id: '', cantidad: 1 }];

  dialogo.innerHTML = `
    <form id="form-venta" novalidate>
      <header class="dialogo__cabecera">
        <h2 id="venta-titulo">Nueva venta</h2>
        <button type="button" class="boton-icono" data-cerrar aria-label="Cerrar">✕</button>
      </header>
      <div class="dialogo__cuerpo">
        <div class="venta-cabecera">
          <fieldset class="campo grupo-sin-borde">
            <legend class="campo__leyenda">Comprobante</legend>
            <div class="segmentado">
              <input type="radio" name="tipo" id="tipo-boleta" value="BOLETA" checked />
              <label for="tipo-boleta">Boleta</label>
              <input type="radio" name="tipo" id="tipo-factura" value="FACTURA" />
              <label for="tipo-factura">Factura</label>
            </div>
          </fieldset>
          <div class="campo campo--sin-margen">
            <label for="venta-cliente">Cliente</label>
            <select id="venta-cliente" name="cliente" data-testid="venta-cliente">
              <option value="">Cliente varios (sin identificar)</option>
              ${clientes.map((c) => `<option value="${c.id}" data-tipo="${esc(c.tipo_documento)}">${esc(c.nombre)} — ${esc(c.tipo_documento)} ${esc(c.numero_documento)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="tabla-contenedor">
          <table class="lineas">
            <thead><tr><th>Producto</th><th class="numero">Cantidad</th><th class="numero">Importe</th><th><span class="solo-lectores">Quitar</span></th></tr></thead>
            <tbody id="venta-lineas"></tbody>
          </table>
        </div>
        <button type="button" class="boton boton--texto" id="venta-agregar">+ Agregar producto</button>

        <div class="totales" data-testid="venta-totales">
          <div><span>Op. gravada</span><span id="venta-subtotal">S/ 0.00</span></div>
          <div><span>IGV 18 %</span><span id="venta-igv">S/ 0.00</span></div>
          <div class="total"><span>Total</span><span id="venta-total" data-testid="venta-total">S/ 0.00</span></div>
        </div>
        <p class="solo-lectores" id="venta-total-anuncio" aria-live="polite" aria-atomic="true"></p>
        <p class="aviso-regla" id="venta-regla" aria-live="polite" hidden></p>
      </div>
      <p class="form-error-general" id="venta-error" role="alert" hidden></p>
      <footer class="dialogo__pie">
        <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
        <button type="submit" class="boton boton--primario" id="venta-registrar" data-testid="venta-registrar">Registrar venta</button>
      </footer>
    </form>`;

  const form = dialogo.querySelector('#form-venta');
  const cuerpo = dialogo.querySelector('#venta-lineas');
  const regla = dialogo.querySelector('#venta-regla');
  const error = dialogo.querySelector('#venta-error');
  const registrar = dialogo.querySelector('#venta-registrar');
  const buscarProducto = (id) => disponibles.find((p) => p.id === Number(id));
  // El total se anuncia al lector de pantalla con un pequeño retraso para no interrumpir al escribir
  let temporizadorTotal;
  const anunciarTotal = (texto) => {
    clearTimeout(temporizadorTotal);
    temporizadorTotal = setTimeout(() => {
      const region = dialogo.querySelector('#venta-total-anuncio');
      if (region) region.textContent = texto;
    }, 700);
  };

  function pintarLineas() {
    cuerpo.innerHTML = lineas
      .map((l, i) => {
        const opciones = disponibles
          .map((p) => `<option value="${p.id}" ${Number(l.producto_id) === p.id ? 'selected' : ''}>${esc(p.nombre)} — ${soles(p.precio_centimos)} (quedan ${p.stock})</option>`)
          .join('');
        return `
          <tr data-linea="${i}">
            <td><select data-campo="producto" aria-label="Producto de la línea ${i + 1}"><option value="">Elige un producto</option>${opciones}</select></td>
            <td class="numero"><input type="number" min="1" step="1" value="${l.cantidad}" data-campo="cantidad" id="venta-cantidad-${i}" aria-label="Cantidad de la línea ${i + 1}" /><span class="campo__error" data-error id="venta-error-${i}"></span></td>
            <td class="numero" data-importe>S/ 0.00</td>
            <td class="acciones"><button type="button" class="boton-icono" data-quitar aria-label="Quitar línea ${i + 1}" ${lineas.length === 1 ? 'disabled' : ''}>✕</button></td>
          </tr>`;
      })
      .join('');
    recalcular();
  }

  /** Recalcula importes, totales y reglas cada vez que el usuario cambia algo. */
  function recalcular() {
    let hayErrores = false;
    const validas = [];
    // Cantidad total pedida por producto (por si se repite en varias líneas)
    const pedidas = new Map();
    lineas.forEach((l) => {
      if (l.producto_id) pedidas.set(Number(l.producto_id), (pedidas.get(Number(l.producto_id)) || 0) + Number(l.cantidad || 0));
    });

    lineas.forEach((l, i) => {
      const fila = cuerpo.querySelector(`[data-linea="${i}"]`);
      const producto = buscarProducto(l.producto_id);
      const cantidad = Number(l.cantidad);
      let mensaje = '';
      if (!Number.isInteger(cantidad) || cantidad < 1) mensaje = 'Mínimo 1';
      else if (producto && pedidas.get(producto.id) > producto.stock) mensaje = `Máx. ${producto.stock}`;
      fila.querySelector('[data-error]').textContent = mensaje;
      const cantidadInput = fila.querySelector('[data-campo="cantidad"]');
      cantidadInput.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      if (mensaje) cantidadInput.setAttribute('aria-describedby', `venta-error-${i}`);
      else cantidadInput.removeAttribute('aria-describedby');
      fila.querySelector('td.numero').classList.toggle('campo--error', Boolean(mensaje));
      const importe = producto && !mensaje ? cantidad * producto.precio_centimos : 0;
      fila.querySelector('[data-importe]').textContent = soles(importe);
      if (mensaje) hayErrores = true;
      if (producto && !mensaje) validas.push({ cantidad, precio: producto.precio_centimos });
    });

    const t = calcularTotales(validas);
    dialogo.querySelector('#venta-subtotal').textContent = soles(t.subtotal);
    dialogo.querySelector('#venta-igv').textContent = soles(t.igv);
    dialogo.querySelector('#venta-total').textContent = soles(t.total);
    anunciarTotal(`Total de la venta: ${soles(t.total)}, IGV incluido.`);

    const tipo = form.elements.tipo.value;
    const opcionCliente = form.elements.cliente.selectedOptions[0];
    const tipoDoc = opcionCliente ? opcionCliente.dataset.tipo : undefined;
    let textoRegla = '';
    if (tipo === 'FACTURA' && tipoDoc !== 'RUC') textoRegla = 'La factura requiere un cliente con RUC. Elige uno de la lista.';
    else if (tipo === 'BOLETA' && t.total > LIMITE_BOLETA_CENTIMOS && !tipoDoc) {
      textoRegla = 'Las boletas mayores a S/ 700.00 deben identificar al cliente (DNI o RUC).';
    }
    regla.textContent = textoRegla;
    regla.hidden = !textoRegla;
    registrar.disabled = hayErrores || Boolean(textoRegla) || validas.length === 0;
  }

  // Eventos de la venta
  form.addEventListener('change', (e) => {
    const fila = e.target.closest('[data-linea]');
    if (fila && e.target.dataset.campo === 'producto') lineas[Number(fila.dataset.linea)].producto_id = e.target.value;
    recalcular();
  });
  form.addEventListener('input', (e) => {
    const fila = e.target.closest('[data-linea]');
    if (fila && e.target.dataset.campo === 'cantidad') {
      lineas[Number(fila.dataset.linea)].cantidad = e.target.value;
      recalcular();
    }
  });
  dialogo.querySelector('#venta-agregar').addEventListener('click', () => {
    lineas.push({ producto_id: '', cantidad: 1 });
    pintarLineas();
    cuerpo.querySelector(`[data-linea="${lineas.length - 1}"] select`).focus();
  });
  dialogo.onclick = (e) => {
    if (e.target.closest('[data-cerrar]')) dialogo.close();
    const quitar = e.target.closest('[data-quitar]');
    if (quitar && lineas.length > 1) {
      lineas.splice(Number(quitar.closest('[data-linea]').dataset.linea), 1);
      pintarLineas();
    }
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    registrar.disabled = true;
    registrar.textContent = 'Registrando…';
    try {
      const r = await api.crear('ventas', {
        tipo_comprobante: form.elements.tipo.value,
        cliente_id: form.elements.cliente.value || null,
        items: lineas.filter((l) => l.producto_id).map((l) => ({ producto_id: Number(l.producto_id), cantidad: Number(l.cantidad) })),
      });
      dialogo.close();
      avisar(r.mensaje);
      await alGuardar();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      registrar.disabled = false;
    } finally {
      registrar.textContent = 'Registrar venta';
    }
  });

  pintarLineas();
  dialogo.showModal();
  cuerpo.querySelector('select').focus();
}
