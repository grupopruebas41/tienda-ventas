'use strict';

const path = require('node:path');
const { AppError } = require('./errores');
const { enviarJson, leerJson } = require('./http/utilidadesHttp');
const { crearRouter } = require('./http/router');
const { crearServidorEstatico } = require('./http/estaticos');
const { enTransaccion } = require('./db/conexion');
const { crearClientesRepositorio } = require('./repositorios/clientesRepositorio');
const { crearProveedoresRepositorio } = require('./repositorios/proveedoresRepositorio');
const { crearProductosRepositorio } = require('./repositorios/productosRepositorio');
const { crearVentasRepositorio } = require('./repositorios/ventasRepositorio');
const { crearClientesServicio } = require('./servicios/clientesServicio');
const { crearProveedoresServicio } = require('./servicios/proveedoresServicio');
const { crearProductosServicio } = require('./servicios/productosServicio');
const { crearVentasServicio } = require('./servicios/ventasServicio');

/** Registra las 5 rutas REST de un recurso (listar, obtener, crear, actualizar, eliminar). */
function registrarCrud(router, base, servicio, nombre, opcionesListado) {
  router.get(base, ({ query }) => {
    const datos = opcionesListado ? servicio.listar(opcionesListado(query)) : servicio.listar(query.get('q'));
    return { status: 200, cuerpo: { datos, total: datos.length } };
  });
  router.get(`${base}/:id`, ({ params }) => ({ status: 200, cuerpo: { datos: servicio.obtener(params.id) } }));
  router.post(base, ({ cuerpo }) => ({
    status: 201,
    cuerpo: { mensaje: `${nombre} registrado.`, datos: servicio.crear(cuerpo) },
  }));
  router.put(`${base}/:id`, ({ params, cuerpo }) => ({
    status: 200,
    cuerpo: { mensaje: `${nombre} actualizado.`, datos: servicio.actualizar(params.id, cuerpo) },
  }));
  router.delete(`${base}/:id`, ({ params }) => ({
    status: 200,
    cuerpo: { mensaje: `${nombre} eliminado.`, datos: servicio.eliminar(params.id) },
  }));
}

/**
 * Crea la aplicación (sin abrir puerto) a partir de una conexión de BD.
 * Separar la app del servidor permite probarla con una BD en memoria.
 */
function crearApp({ db, registrarPeticiones = false }) {
  const repos = {
    clientes: crearClientesRepositorio(db),
    proveedores: crearProveedoresRepositorio(db),
    productos: crearProductosRepositorio(db),
    ventas: crearVentasRepositorio(db),
  };
  const servicios = {
    clientes: crearClientesServicio(repos.clientes),
    proveedores: crearProveedoresServicio(repos.proveedores),
    productos: crearProductosServicio(repos.productos, repos.proveedores),
    ventas: crearVentasServicio({
      ventasRepositorio: repos.ventas,
      productosRepositorio: repos.productos,
      clientesRepositorio: repos.clientes,
      transaccion: (fn) => enTransaccion(db, fn),
    }),
  };

  const router = crearRouter();
  router.get('/api/salud', () => ({ status: 200, cuerpo: { estado: 'ok' } }));
  router.get('/api/resumen', () => ({ status: 200, cuerpo: { datos: servicios.ventas.resumen() } }));
  registrarCrud(router, '/api/clientes', servicios.clientes, 'Cliente');
  registrarCrud(router, '/api/proveedores', servicios.proveedores, 'Proveedor');
  registrarCrud(router, '/api/productos', servicios.productos, 'Producto', (query) => ({
    busqueda: query.get('q'),
    soloStockBajo: query.get('stockBajo') === '1',
  }));
  router.get('/api/ventas', () => {
    const datos = servicios.ventas.listar();
    return { status: 200, cuerpo: { datos, total: datos.length } };
  });
  router.get('/api/ventas/:id', ({ params }) => ({ status: 200, cuerpo: { datos: servicios.ventas.obtener(params.id) } }));
  router.post('/api/ventas', ({ cuerpo }) => {
    const venta = servicios.ventas.registrar(cuerpo);
    return { status: 201, cuerpo: { mensaje: `Venta ${venta.comprobante} registrada.`, datos: venta } };
  });
  router.post('/api/ventas/:id/anular', ({ params }) => {
    const venta = servicios.ventas.anular(params.id);
    return { status: 200, cuerpo: { mensaje: `Venta ${venta.comprobante} anulada.`, datos: venta } };
  });

  const servirPublico = crearServidorEstatico(path.join(__dirname, '..', 'public'), '/');
  const servirCompartido = crearServidorEstatico(path.join(__dirname, 'shared'), '/shared/');

  async function manejador(req, res) {
    const inicio = Date.now();
    const url = new URL(req.url, 'http://localhost');
    const ruta = url.pathname;
    try {
      if (ruta.startsWith('/api/')) {
        const encontrada = router.resolver(req.method, ruta);
        if (!encontrada) throw AppError.noEncontrado(`La ruta ${ruta}`);
        if (encontrada.metodoNoPermitido) throw new AppError(405, `Método ${req.method} no permitido en ${ruta}.`);
        const cuerpo = ['POST', 'PUT'].includes(req.method) ? await leerJson(req) : {};
        const respuesta = encontrada.manejador({ params: encontrada.params, query: url.searchParams, cuerpo });
        enviarJson(res, respuesta.status, respuesta.cuerpo);
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        // Rutas sin extensión (ej. /clientes) devuelven index.html: la SPA decide qué vista mostrar.
        const servido =
          servirCompartido(req, res, ruta) ||
          servirPublico(req, res, ruta) ||
          (path.extname(ruta) === '' && servirPublico(req, res, '/'));
        if (!servido) throw AppError.noEncontrado('La página');
      } else {
        throw new AppError(405, 'Método no permitido.');
      }
    } catch (error) {
      if (error instanceof AppError) {
        enviarJson(res, error.status, { error: error.message, errores: error.errores });
      } else {
        console.error(error);
        enviarJson(res, 500, { error: 'Ocurrió un error inesperado en el servidor. Inténtalo de nuevo.' });
      }
    } finally {
      if (registrarPeticiones) {
        console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - inicio} ms)`);
      }
    }
  }

  return { manejador, servicios, repos };
}

module.exports = { crearApp };
