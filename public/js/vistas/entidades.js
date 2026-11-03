import { api } from '../api.js';
import { esc, soles } from '../ui.js';
import { crearVistaCrud } from './crud.js';

const V = () => window.Validaciones;
const opcional = (valor) => (valor ? esc(valor) : '<span class="secundario">—</span>');

/* ======================= Clientes ======================= */
export const vistaClientes = crearVistaCrud({
  recurso: 'clientes',
  titulo: 'Clientes',
  nombre: 'cliente',
  unidad: ['cliente', 'clientes'],
  descripcion: 'Personas y empresas que compran en la tienda. Las facturas solo se emiten a clientes con RUC.',
  botonNuevo: 'Nuevo cliente',
  placeholderBusqueda: 'Buscar por nombre, DNI, RUC o correo',
  vacio: { titulo: 'Aún no hay clientes.', texto: ' Registra el primero con el botón "Nuevo cliente".' },
  etiqueta: (c) => c.nombre,
  columnas: [
    {
      titulo: 'Cliente',
      celda: (c) => `${esc(c.nombre)}<span class="secundario">${opcional(c.email)}</span>`,
    },
    {
      titulo: 'Documento',
      celda: (c) => `<span class="etiqueta etiqueta--neutra">${esc(c.tipo_documento)}</span> <span class="doc">${esc(c.numero_documento)}</span>`,
    },
    { titulo: 'Teléfono', clase: 'ocultar-movil', celda: (c) => opcional(c.telefono) },
    { titulo: 'Dirección', clase: 'ocultar-movil', celda: (c) => opcional(c.direccion) },
  ],
  campos: async () => [
    {
      nombre: 'tipo_documento',
      etiqueta: 'Tipo de documento',
      tipo: 'select',
      requerido: true,
      porDefecto: 'DNI',
      opciones: [
        { valor: 'DNI', texto: 'DNI' },
        { valor: 'RUC', texto: 'RUC' },
      ],
    },
    {
      nombre: 'numero_documento',
      etiqueta: 'Número de documento',
      requerido: true,
      inputmode: 'numeric',
      maxlength: 11,
      ayuda: 'DNI: 8 dígitos.',
    },
    { nombre: 'nombre', etiqueta: 'Nombre o razón social', requerido: true, maxlength: 100, completo: true, autocomplete: 'name' },
    { nombre: 'email', etiqueta: 'Correo', tipo: 'email', maxlength: 100, placeholder: 'cliente@correo.pe', autocomplete: 'email' },
    { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', inputmode: 'tel', maxlength: 9, placeholder: '9XXXXXXXX', autocomplete: 'tel' },
    { nombre: 'direccion', etiqueta: 'Dirección', maxlength: 150, completo: true, autocomplete: 'street-address' },
  ],
  validar: (datos) => V().validarCliente(datos),
  // Evento: al cambiar el tipo de documento se adapta el límite y la ayuda del número.
  alCambiar: (form, campo) => {
    if (campo !== null && campo !== 'tipo_documento') return;
    const esRuc = form.elements.tipo_documento.value === 'RUC';
    form.elements.numero_documento.maxLength = esRuc ? 11 : 8;
    const ayuda = form.querySelector('#campo-numero_documento-ayuda');
    if (ayuda) ayuda.textContent = esRuc ? 'RUC: 11 dígitos, empieza con 10 o 20.' : 'DNI: 8 dígitos.';
  },
});

/* ======================= Proveedores ======================= */
export const vistaProveedores = crearVistaCrud({
  recurso: 'proveedores',
  titulo: 'Proveedores',
  nombre: 'proveedor',
  unidad: ['proveedor', 'proveedores'],
  descripcion: 'Empresas que abastecen los productos. Un proveedor con productos asignados no se puede eliminar.',
  botonNuevo: 'Nuevo proveedor',
  placeholderBusqueda: 'Buscar por razón social, RUC o contacto',
  vacio: { titulo: 'Aún no hay proveedores.', texto: ' Registra uno para poder crear productos.' },
  etiqueta: (p) => p.razon_social,
  columnas: [
    { titulo: 'Razón social', celda: (p) => `${esc(p.razon_social)}<span class="secundario">${opcional(p.email)}</span>` },
    { titulo: 'RUC', celda: (p) => `<span class="doc">${esc(p.ruc)}</span>` },
    { titulo: 'Contacto', clase: 'ocultar-movil', celda: (p) => `${opcional(p.contacto)}<span class="secundario">${esc(p.telefono)}</span>` },
    { titulo: 'Productos', clase: 'numero', celda: (p) => String(p.total_productos) },
  ],
  campos: async () => [
    { nombre: 'ruc', etiqueta: 'RUC', requerido: true, inputmode: 'numeric', maxlength: 11, ayuda: '11 dígitos; se verifica el dígito final.' },
    { nombre: 'telefono', etiqueta: 'Teléfono', requerido: true, tipo: 'tel', inputmode: 'tel', maxlength: 9, autocomplete: 'tel' },
    { nombre: 'razon_social', etiqueta: 'Razón social', requerido: true, maxlength: 100, completo: true, autocomplete: 'organization' },
    { nombre: 'contacto', etiqueta: 'Persona de contacto', maxlength: 100, autocomplete: 'name' },
    { nombre: 'email', etiqueta: 'Correo', tipo: 'email', maxlength: 100, autocomplete: 'email' },
    { nombre: 'direccion', etiqueta: 'Dirección', maxlength: 150, completo: true, autocomplete: 'street-address' },
  ],
  validar: (datos) => V().validarProveedor(datos),
});

/* ======================= Productos ======================= */
function etiquetaStock(p) {
  if (p.stock === 0) return '<span class="etiqueta etiqueta--anulada">Agotado</span>';
  if (p.stock <= p.stock_minimo) return `<span class="etiqueta etiqueta--alerta">${p.stock} · reponer</span>`;
  return `<span class="etiqueta etiqueta--ok">${p.stock}</span>`;
}

export const vistaProductos = crearVistaCrud({
  recurso: 'productos',
  titulo: 'Productos',
  nombre: 'producto',
  unidad: ['producto', 'productos'],
  descripcion: 'Catálogo con precio de venta (incluye IGV) y stock disponible.',
  botonNuevo: 'Nuevo producto',
  placeholderBusqueda: 'Buscar por nombre, código o categoría',
  filtros: [{ nombre: 'stock-bajo', parametro: 'stockBajo', etiqueta: 'Solo stock bajo' }],
  vacio: { titulo: 'Aún no hay productos.', texto: ' Registra el primero con el botón "Nuevo producto".' },
  etiqueta: (p) => p.nombre,
  columnas: [
    { titulo: 'Código', celda: (p) => `<span class="doc">${esc(p.codigo)}</span>` },
    { titulo: 'Producto', celda: (p) => `${esc(p.nombre)}<span class="secundario">${esc(p.categoria)}</span>` },
    { titulo: 'Proveedor', clase: 'ocultar-movil', celda: (p) => esc(p.proveedor) },
    { titulo: 'Precio', clase: 'numero', celda: (p) => soles(p.precio_centimos) },
    { titulo: 'Stock', clase: 'numero', celda: etiquetaStock },
  ],
  campos: async () => {
    const { datos: proveedores } = await api.listar('proveedores');
    return [
      { nombre: 'codigo', etiqueta: 'Código', requerido: true, maxlength: 8, placeholder: 'ABA-0004', ayuda: 'Formato: 3 letras, guion y 4 números.' },
      {
        nombre: 'categoria',
        etiqueta: 'Categoría',
        tipo: 'select',
        requerido: true,
        vacio: 'Elige una categoría',
        opciones: V().CATEGORIAS.map((c) => ({ valor: c, texto: c })),
      },
      { nombre: 'nombre', etiqueta: 'Nombre del producto', requerido: true, maxlength: 100, completo: true },
      { nombre: 'precio', etiqueta: 'Precio de venta (S/)', requerido: true, tipo: 'number', step: '0.01', min: 0, inputmode: 'decimal', ayuda: 'Incluye IGV.' },
      {
        nombre: 'proveedor_id',
        etiqueta: 'Proveedor',
        tipo: 'select',
        requerido: true,
        vacio: 'Elige un proveedor',
        opciones: proveedores.map((p) => ({ valor: p.id, texto: p.razon_social })),
      },
      { nombre: 'stock', etiqueta: 'Stock actual', requerido: true, tipo: 'number', step: '1', min: 0, porDefecto: '0' },
      { nombre: 'stock_minimo', etiqueta: 'Stock mínimo', requerido: true, tipo: 'number', step: '1', min: 0, porDefecto: '5', ayuda: 'Debajo de este número se marca "reponer".' },
    ];
  },
  aFormulario: (p) => ({ ...p, precio: (p.precio_centimos / 100).toFixed(2) }),
  validar: (datos) => V().validarProducto(datos),
});
