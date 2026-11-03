'use strict';

/**
 * PRUEBAS UNITARIAS — servicios con DOBLES DE PRUEBA (mocks).
 * El repositorio se reemplaza por funciones simuladas (mock.fn) para probar
 * SOLO la lógica del servicio, sin base de datos.
 */
const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { crearClientesServicio } = require('../../src/servicios/clientesServicio');
const { crearProveedoresServicio } = require('../../src/servicios/proveedoresServicio');
const { crearProductosServicio } = require('../../src/servicios/productosServicio');
const { crearVentasServicio } = require('../../src/servicios/ventasServicio');
const { AppError } = require('../../src/errores');

const CLIENTE_VALIDO = {
  tipo_documento: 'DNI',
  numero_documento: '41234567',
  nombre: '  Ana   Lucía Poma ',
  email: 'ANA@CORREO.PE',
  telefono: '987 111 222',
  direccion: '',
};

function repoClientesFalso(sobrescribir = {}) {
  return {
    listar: mock.fn(() => []),
    obtener: mock.fn((id) => (id === 1 ? { id: 1, nombre: 'Cliente 1' } : null)),
    buscarPorDocumento: mock.fn(() => null),
    crear: mock.fn((c) => ({ id: 99, ...c })),
    actualizar: mock.fn((id, c) => ({ id, ...c })),
    eliminar: mock.fn(() => true),
    contarVentas: mock.fn(() => 0),
    ...sobrescribir,
  };
}

/** Verifica que fn lance AppError con el status indicado. */
function lanzaAppError(fn, status) {
  assert.throws(fn, (e) => e instanceof AppError && e.status === status);
}

describe('Unitarias: clientesServicio', () => {
  it('PU-SRV-01 crear normaliza los datos antes de guardarlos', () => {
    const repo = repoClientesFalso();
    const creado = crearClientesServicio(repo).crear(CLIENTE_VALIDO);
    assert.equal(repo.crear.mock.callCount(), 1);
    const guardado = repo.crear.mock.calls[0].arguments[0];
    assert.equal(guardado.nombre, 'Ana Lucía Poma');
    assert.equal(guardado.email, 'ana@correo.pe');
    assert.equal(guardado.telefono, '987111222');
    assert.equal(guardado.direccion, null);
    assert.equal(creado.id, 99);
  });

  it('PU-SRV-02 crear con datos inválidos lanza 422 y NO llama al repositorio', () => {
    const repo = repoClientesFalso();
    lanzaAppError(() => crearClientesServicio(repo).crear({ tipo_documento: 'DNI', numero_documento: '1' }), 422);
    assert.equal(repo.crear.mock.callCount(), 0);
  });

  it('PU-SRV-03 crear con documento duplicado lanza 409', () => {
    const repo = repoClientesFalso({ buscarPorDocumento: mock.fn(() => ({ id: 5 })) });
    lanzaAppError(() => crearClientesServicio(repo).crear(CLIENTE_VALIDO), 409);
    assert.equal(repo.crear.mock.callCount(), 0);
  });

  it('PU-SRV-04 actualizar permite conservar el mismo documento del propio cliente', () => {
    const repo = repoClientesFalso({ buscarPorDocumento: mock.fn(() => ({ id: 1 })) });
    const r = crearClientesServicio(repo).actualizar(1, CLIENTE_VALIDO);
    assert.equal(r.id, 1);
    assert.equal(repo.actualizar.mock.callCount(), 1);
  });

  it('PU-SRV-05 eliminar un cliente con ventas lanza 409 y no elimina', () => {
    const repo = repoClientesFalso({ contarVentas: mock.fn(() => 2) });
    lanzaAppError(() => crearClientesServicio(repo).eliminar(1), 409);
    assert.equal(repo.eliminar.mock.callCount(), 0);
  });

  it('PU-SRV-06 obtener un id inexistente lanza 404 y un id no numérico lanza 400', () => {
    const servicio = crearClientesServicio(repoClientesFalso());
    lanzaAppError(() => servicio.obtener(50), 404);
    lanzaAppError(() => servicio.obtener('abc'), 400);
    lanzaAppError(() => servicio.obtener(-1), 400);
  });
});

describe('Unitarias: proveedoresServicio y productosServicio', () => {
  it('PU-SRV-07 no se elimina un proveedor que abastece productos', () => {
    const repo = {
      obtener: mock.fn(() => ({ id: 3, razon_social: 'Molinera' })),
      contarProductos: mock.fn(() => 4),
      eliminar: mock.fn(),
    };
    lanzaAppError(() => crearProveedoresServicio(repo).eliminar(3), 409);
    assert.equal(repo.eliminar.mock.callCount(), 0);
  });

  it('PU-SRV-08 crear producto con proveedor inexistente lanza 422 en proveedor_id', () => {
    const repo = { buscarPorCodigo: mock.fn(() => null), crear: mock.fn() };
    const proveedores = { obtener: mock.fn(() => null) };
    try {
      crearProductosServicio(repo, proveedores).crear({
        codigo: 'ABA-0100',
        nombre: 'Avena 1 kg',
        categoria: 'Abarrotes',
        precio: '7.50',
        stock: '5',
        stock_minimo: '1',
        proveedor_id: '77',
      });
      assert.fail('Debía lanzar error');
    } catch (e) {
      assert.equal(e.status, 422);
      assert.ok(e.errores.proveedor_id);
    }
    assert.equal(repo.crear.mock.callCount(), 0);
  });

  it('PU-SRV-09 crear producto convierte el precio a céntimos y el código a mayúsculas', () => {
    const repo = { buscarPorCodigo: mock.fn(() => null), crear: mock.fn((p) => p) };
    const r = crearProductosServicio(repo, { obtener: () => ({ id: 1 }) }).crear({
      codigo: 'aba-0100',
      nombre: 'Avena 1 kg',
      categoria: 'Abarrotes',
      precio: '7.5',
      stock: '5',
      stock_minimo: '1',
      proveedor_id: '1',
    });
    assert.equal(r.codigo, 'ABA-0100');
    assert.equal(r.precio_centimos, 750);
    assert.equal(r.stock, 5);
  });
});

describe('Unitarias: ventasServicio con dobles de prueba', () => {
  function dependencias() {
    const productos = new Map([[1, { id: 1, codigo: 'LAC-0001', nombre: 'Leche', precio_centimos: 450, stock: 10 }]]);
    return {
      ventasRepositorio: {
        siguienteCorrelativo: mock.fn(() => 7),
        crear: mock.fn(() => 500),
        agregarDetalle: mock.fn(),
        obtener: mock.fn((id) => ({ id, serie: 'B001', correlativo: 7, estado: 'EMITIDA', detalle: [] })),
      },
      productosRepositorio: {
        obtener: mock.fn((id) => productos.get(id) || null),
        descontarStock: mock.fn(() => true),
      },
      clientesRepositorio: { obtener: mock.fn(() => null) },
      transaccion: mock.fn((fn) => fn()),
    };
  }

  it('PU-SRV-10 registrar usa una transacción y descuenta el stock correcto', () => {
    const deps = dependencias();
    const venta = crearVentasServicio(deps).registrar({
      tipo_comprobante: 'boleta',
      items: [{ producto_id: 1, cantidad: 3 }],
    });
    assert.equal(deps.transaccion.mock.callCount(), 1);
    assert.deepEqual(deps.productosRepositorio.descontarStock.mock.calls[0].arguments, [1, 3]);
    const cabecera = deps.ventasRepositorio.crear.mock.calls[0].arguments[0];
    assert.equal(cabecera.serie, 'B001');
    assert.equal(cabecera.correlativo, 7);
    assert.equal(cabecera.total_centimos, 1350);
    assert.equal(venta.comprobante, 'B001-00000007');
  });

  it('PU-SRV-11 si la validación falla no se abre la transacción', () => {
    const deps = dependencias();
    lanzaAppError(() => crearVentasServicio(deps).registrar({ tipo_comprobante: 'BOLETA', items: [] }), 422);
    assert.equal(deps.transaccion.mock.callCount(), 0);
  });
});
