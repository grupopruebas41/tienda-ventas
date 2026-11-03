'use strict';

/**
 * PRUEBAS DE CAJA BLANCA — ramas que faltaban cubrir (SonarQube y node:test)
 *   abrirBaseDatos():       archivo en disco (carpeta + WAL), sin datos de ejemplo, BD existente
 *   crearServidorEstatico(): prefijo distinto, "/" final, carpeta, inexistente, extensión desconocida, HEAD
 *   manejador (app.js):     405 fuera de /api, 404 "La página", ruta de la SPA, HEAD, 500 y registro de peticiones
 *   validaciones.js:        rama UMD del navegador (sin "module")
 *   servicios y repositorios: datos nulos, dirección larga, categoría, stock vacío, venta inexistente,
 *                             primer correlativo y listados sin filtros
 *
 * Rama no cubierta a propósito: en ventasServicio.js, conComprobante(venta) tiene la
 * rama ": venta" para venta nula, pero nunca la recibe (listar() solo trae filas
 * existentes y obtener() lanza 404 antes). Es defensiva e inalcanzable.
 */
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { abrirBaseDatos } = require('../../src/db/conexion');
const { crearServidorEstatico } = require('../../src/http/estaticos');
const { crearApp } = require('../../src/app');
const { AppError } = require('../../src/errores');
const {
  validarCliente,
  validarProveedor,
  validarProducto,
  validarRuc,
} = require('../../src/shared/validaciones');

/** Levanta crearApp en un puerto libre y devuelve una función para hacer peticiones. */
async function levantar(opciones) {
  const { manejador } = crearApp(opciones);
  const servidor = http.createServer(manejador);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${servidor.address().port}`;
  return {
    peticion: (metodo, ruta) => fetch(url + ruta, { method: metodo }),
    cerrar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

/** Respuesta falsa: guarda lo que el servidor estático escribe. */
function respuestaFalsa() {
  return {
    status: null,
    cabeceras: null,
    cuerpo: null,
    writeHead(status, cabeceras) {
      this.status = status;
      this.cabeceras = cabeceras;
    },
    end(cuerpo) {
      this.cuerpo = cuerpo;
    },
  };
}

/** Verifica que fn lance AppError con el status indicado y devuelve el error. */
function capturarAppError(fn, status) {
  let capturado;
  assert.throws(fn, (e) => {
    capturado = e;
    return e instanceof AppError && e.status === status;
  });
  return capturado;
}

/** RUC válido construido con el propio validador (prueba el dígito verificador 0..9). */
function rucValido(diezDigitos) {
  return [...'0123456789'].map((d) => diezDigitos + d).find((ruc) => validarRuc(ruc) === null);
}

describe('Caja blanca: abrirBaseDatos con archivo en disco', () => {
  let carpetaTemporal;
  let archivo;

  before(() => {
    carpetaTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-bd-'));
    archivo = path.join(carpetaTemporal, 'subcarpeta', 'tienda.db');
  });

  after(() => {
    fs.rmSync(carpetaTemporal, { recursive: true, force: true });
  });

  it('CB-COV-01 rama "archivo" (no :memory:): crea la carpeta y activa el modo WAL', () => {
    assert.equal(fs.existsSync(path.dirname(archivo)), false);
    const db = abrirBaseDatos({ archivo, datosDemo: false });
    try {
      assert.equal(fs.existsSync(archivo), true);
      assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    } finally {
      db.close();
    }
  });

  it('CB-COV-02 rama datosDemo:false: crea el esquema sin datos de ejemplo', () => {
    const db = abrirBaseDatos({ archivo: ':memory:', datosDemo: false });
    try {
      const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
      for (const tabla of ['clientes', 'proveedores', 'productos', 'ventas']) assert.ok(tablas.includes(tabla), tabla);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM productos').get().n, 0);
    } finally {
      db.close();
    }
  });

  it('CB-COV-03 rama "ya tiene tablas": al reabrir no recrea el esquema ni carga datos de ejemplo', () => {
    const primera = abrirBaseDatos({ archivo, datosDemo: false });
    primera
      .prepare('INSERT INTO clientes (tipo_documento, numero_documento, nombre) VALUES (?, ?, ?)')
      .run('DNI', '41234567', 'Cliente persistente');
    primera.close();

    // Aunque se pida datosDemo, la BD ya existe: se conserva lo guardado y no se agrega el seed
    const segunda = abrirBaseDatos({ archivo, datosDemo: true });
    try {
      const clientes = segunda.prepare('SELECT nombre FROM clientes').all().map((c) => c.nombre);
      assert.deepEqual(clientes, ['Cliente persistente']);
      assert.equal(segunda.prepare('SELECT COUNT(*) AS n FROM productos').get().n, 0);
    } finally {
      segunda.close();
    }
  });
});

describe('Caja blanca: crearServidorEstatico', () => {
  let raiz;
  let servir;

  before(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-estaticos-'));
    fs.mkdirSync(path.join(raiz, 'sub'));
    fs.writeFileSync(path.join(raiz, 'index.html'), '<h1>Inicio</h1>');
    fs.writeFileSync(path.join(raiz, 'sub', 'index.html'), '<h1>Sub</h1>');
    fs.writeFileSync(path.join(raiz, 'datos.xyz'), 'contenido binario');
    servir = crearServidorEstatico(raiz, '/estaticos/');
  });

  after(() => {
    fs.rmSync(raiz, { recursive: true, force: true });
  });

  it('CB-COV-04 rama "no empieza con el prefijo": devuelve false sin responder', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'GET' }, res, '/otra/index.html'), false);
    assert.equal(res.status, null);
  });

  it('CB-COV-05 rama "termina en /": sirve el index.html de la carpeta', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'GET' }, res, '/estaticos/sub/'), true);
    assert.equal(res.status, 200);
    assert.equal(res.cabeceras['Content-Type'], 'text/html; charset=utf-8');
    assert.equal(res.cuerpo.toString(), '<h1>Sub</h1>');
  });

  it('CB-COV-06 rama "es carpeta, no archivo": devuelve false', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'GET' }, res, '/estaticos/sub'), false);
    assert.equal(res.status, null);
  });

  it('CB-COV-07 rama catch (archivo inexistente): devuelve false', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'GET' }, res, '/estaticos/no-existe.html'), false);
    assert.equal(res.status, null);
  });

  it('CB-COV-08 rama "extensión desconocida": responde application/octet-stream', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'GET' }, res, '/estaticos/datos.xyz'), true);
    assert.equal(res.cabeceras['Content-Type'], 'application/octet-stream');
    assert.equal(res.cuerpo.toString(), 'contenido binario');
  });

  it('CB-COV-09 rama HEAD: responde 200 con Content-Length y sin cuerpo', () => {
    const res = respuestaFalsa();
    assert.equal(servir({ method: 'HEAD' }, res, '/estaticos/'), true);
    assert.equal(res.status, 200);
    assert.equal(res.cabeceras['Content-Length'], Buffer.byteLength('<h1>Inicio</h1>'));
    assert.equal(res.cuerpo, undefined);
  });
});

describe('Caja blanca: manejador de app.js', () => {
  let db;
  let app;

  before(async () => {
    db = abrirBaseDatos({ archivo: ':memory:', datosDemo: true });
    app = await levantar({ db });
  });

  after(async () => {
    await app.cerrar();
    db.close();
  });

  it('CB-COV-10 rama "método distinto de GET/HEAD fuera de /api": responde 405', async () => {
    const r = await app.peticion('POST', '/index.html');
    assert.equal(r.status, 405);
    assert.equal((await r.json()).error, 'Método no permitido.');
  });

  it('CB-COV-11 rama "archivo con extensión que no existe": responde 404 "La página"', async () => {
    const r = await app.peticion('GET', '/no-existe.css');
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error, 'La página no existe o ya fue eliminado.');
  });

  it('CB-COV-12 rama "ruta sin extensión" (SPA): /clientes devuelve index.html', async () => {
    const r = await app.peticion('GET', '/clientes');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /<html/i);
  });

  it('CB-COV-13 rama HEAD fuera de /api: responde 200 sin cuerpo', async () => {
    const r = await app.peticion('HEAD', '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.equal(await r.text(), '');
  });

  it('CB-COV-14 rama "error que no es AppError": responde 500 con mensaje genérico', async () => {
    const dbCerrada = abrirBaseDatos({ archivo: ':memory:', datosDemo: false });
    const rota = await levantar({ db: dbCerrada });
    dbCerrada.close(); // cualquier consulta lanzará un Error común de SQLite
    const consola = mock.method(console, 'error', () => {});
    try {
      const r = await rota.peticion('GET', '/api/clientes');
      assert.equal(r.status, 500);
      const cuerpo = await r.json();
      assert.equal(cuerpo.error, 'Ocurrió un error inesperado en el servidor. Inténtalo de nuevo.');
      assert.doesNotMatch(JSON.stringify(cuerpo), /database|sqlite/i, 'no debe filtrar detalles internos');
      assert.equal(consola.mock.callCount(), 1);
      assert.ok(consola.mock.calls[0].arguments[0] instanceof Error);
      assert.ok(!(consola.mock.calls[0].arguments[0] instanceof AppError));
    } finally {
      consola.mock.restore();
      await rota.cerrar();
    }
  });

  it('CB-COV-15 rama registrarPeticiones:true: escribe método, ruta, estado y tiempo', async () => {
    const dbLog = abrirBaseDatos({ archivo: ':memory:', datosDemo: false });
    const conLog = await levantar({ db: dbLog, registrarPeticiones: true });
    const consola = mock.method(console, 'log', () => {});
    try {
      const r = await app.peticion('GET', '/api/salud'); // app sin registro: no escribe nada
      assert.equal(r.status, 200);
      assert.equal(consola.mock.callCount(), 0);
      await conLog.peticion('GET', '/api/salud');
      await conLog.peticion('GET', '/api/no-existe');
      const lineas = consola.mock.calls.map((c) => c.arguments[0]);
      assert.equal(lineas.length, 2);
      assert.match(lineas[0], /^GET \/api\/salud → 200 \(\d+ ms\)$/);
      assert.match(lineas[1], /^GET \/api\/no-existe → 404 \(\d+ ms\)$/);
    } finally {
      consola.mock.restore();
      await conLog.cerrar();
      dbLog.close();
    }
  });
});

describe('Caja blanca: validaciones.js en el navegador (UMD)', () => {
  it('CB-COV-16 rama "sin module" (navegador): define self.Validaciones', () => {
    const archivo = path.join(__dirname, '..', '..', 'src', 'shared', 'validaciones.js');
    const contexto = vm.createContext({});
    contexto.self = contexto; // en el navegador self es la ventana (window)
    vm.runInContext(fs.readFileSync(archivo, 'utf8'), contexto, { filename: archivo });

    assert.equal(typeof contexto.module, 'undefined');
    const V = contexto.self.Validaciones;
    assert.ok(V, 'no se definió self.Validaciones');
    for (const nombre of ['validarCliente', 'validarProveedor', 'validarProducto', 'validarRuc', 'formatearSoles', 'escaparHtml']) {
      assert.equal(typeof V[nombre], 'function', nombre);
    }
    // Las funciones del navegador dan los mismos mensajes que en Node.js
    assert.equal(V.validarRuc('123'), validarRuc('123'));
    assert.equal(V.formatearSoles(1250), 'S/ 12.50');
  });
});

describe('Caja blanca: validaciones con datos nulos y reglas sin probar', () => {
  it('CB-COV-17 rama "datos || {}": validarCliente/Proveedor/Producto(undefined) no fallan y piden lo obligatorio', () => {
    const c = validarCliente(undefined);
    assert.equal(c.valido, false);
    assert.equal(c.errores.tipo_documento, 'Elige DNI o RUC.');
    assert.equal(c.errores.nombre, 'El nombre es obligatorio.');

    const p = validarProveedor(null);
    assert.equal(p.errores.ruc, 'El RUC es obligatorio.');
    assert.equal(p.errores.telefono, 'El teléfono es obligatorio.');

    const pr = validarProducto(undefined);
    assert.equal(pr.errores.codigo, 'El código es obligatorio.');
    assert.equal(pr.errores.proveedor_id, 'Elige un proveedor.');
  });

  it('CB-COV-18 rama "dirección > 150 caracteres" en cliente y proveedor', () => {
    const mensaje = 'La dirección admite como máximo 150 caracteres.';
    const larga = 'Av. '.padEnd(151, 'x');
    assert.equal(validarCliente({ direccion: larga }).errores.direccion, mensaje);
    assert.equal(validarProveedor({ direccion: larga }).errores.direccion, mensaje);
    // En el límite (150) es válida
    assert.equal(validarCliente({ direccion: larga.slice(0, 150) }).errores.direccion, undefined);
  });

  it('CB-COV-19 ramas de producto: categoría fuera de lista, stock vacío y precio entero sin decimales', () => {
    const base = { codigo: 'ABC-0001', nombre: 'Arroz', categoria: 'Abarrotes', precio: '12', stock: '5', stock_minimo: '1', proveedor_id: '1' };
    assert.deepEqual(validarProducto(base), { valido: true, errores: {} }); // "12": contarDecimales → 0
    assert.equal(validarProducto({ ...base, categoria: 'Juguetes' }).errores.categoria, 'Elige una categoría de la lista.');
    assert.equal(validarProducto({ ...base, stock: '' }).errores.stock, 'El stock es obligatorio.');
    assert.equal(validarProducto({ ...base, stock_minimo: '  ' }).errores.stock_minimo, 'El stock mínimo es obligatorio.');
  });
});

describe('Caja blanca: servicios y repositorios', () => {
  let db;
  let servicios;
  let repos;

  before(() => {
    db = abrirBaseDatos({ archivo: ':memory:', datosDemo: false });
    ({ servicios, repos } = crearApp({ db }));
  });

  after(() => db.close());

  it('CB-COV-20 rama "datos || {}" de crudServicio: crear(null) y actualizar(id, null) responden 422', () => {
    const errorCrear = capturarAppError(() => servicios.clientes.crear(null), 422);
    assert.equal(errorCrear.errores.nombre, 'El nombre es obligatorio.');

    const cliente = servicios.clientes.crear({ tipo_documento: 'DNI', numero_documento: '41234567', nombre: 'Ana Poma' });
    const errorActualizar = capturarAppError(() => servicios.clientes.actualizar(cliente.id, undefined), 422);
    assert.equal(errorActualizar.errores.tipo_documento, 'Elige DNI o RUC.');
    assert.equal(servicios.clientes.obtener(cliente.id).nombre, 'Ana Poma', 'no debe modificarse');
  });

  it('CB-COV-21 rama "venta inexistente": obtener responde 404 (repositorio devuelve null)', () => {
    assert.equal(repos.ventas.obtener(9999), null);
    const error = capturarAppError(() => servicios.ventas.obtener(9999), 404);
    assert.equal(error.message, 'La venta no existe o ya fue eliminado.');
  });

  it('CB-COV-22 rama "datos || {}" de registrar: registrar(null) responde 422 por el comprobante', () => {
    const error = capturarAppError(() => servicios.ventas.registrar(null), 422);
    assert.deepEqual(error.errores, { tipo_comprobante: 'Elige boleta o factura.' });
  });

  it('CB-COV-23 rama "|| 0" de siguienteCorrelativo: la primera venta de la serie es la 00000001', () => {
    assert.equal(repos.ventas.siguienteCorrelativo('B001'), 1);
    const proveedor = servicios.proveedores.crear({ ruc: rucValido('2060000000'), razon_social: 'Proveedor Andino', telefono: '987654321' });
    const producto = servicios.productos.crear({
      codigo: 'ABC-0001', nombre: 'Arroz extra', categoria: 'Abarrotes', precio: '4.50', stock: '10', stock_minimo: '2', proveedor_id: proveedor.id,
    });
    const venta = servicios.ventas.registrar({ tipo_comprobante: 'BOLETA', items: [{ producto_id: producto.id, cantidad: 2 }] });
    assert.equal(venta.correlativo, 1);
    assert.equal(venta.comprobante, 'B001-00000001');
    assert.equal(repos.ventas.siguienteCorrelativo('B001'), 2);
  });

  it('CB-COV-24 rama "sin filtros" de los repositorios: listar devuelve todos los registros', () => {
    const totalProveedores = db.prepare('SELECT COUNT(*) AS n FROM proveedores').get().n;
    const totalProductos = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n;
    assert.ok(totalProveedores > 0 && totalProductos > 0);
    assert.equal(repos.proveedores.listar('').length, totalProveedores);
    assert.equal(repos.productos.listar({}).length, totalProductos);
    assert.equal(repos.productos.listar().length, totalProductos);
  });
});
