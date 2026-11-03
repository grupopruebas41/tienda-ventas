'use strict';

/**
 * PRUEBAS DE CAJA NEGRA — API de clientes (/api/clientes)
 * Diseñadas SOLO con la especificación (sin mirar el código):
 *   - Partición de equivalencia (clases válidas / inválidas)
 *   - Análisis de valores límite
 * Se ejecutan contra el servidor real con una BD SQLite en memoria.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('../helpers/servidor');

let srv;
before(async () => {
  srv = await iniciarServidor();
});
after(() => srv.cerrar());

let dniSecuencia = 30000000;
const nuevoDni = () => String(dniSecuencia++);
const cliente = (extra = {}) => ({
  tipo_documento: 'DNI',
  numero_documento: nuevoDni(),
  nombre: 'Rosa Elvira Quispe',
  telefono: '964123456',
  ...extra,
});

describe('Caja negra: registrar cliente — partición de equivalencia del DNI', () => {
  // Clase válida CV1: 8 dígitos. Clases inválidas: CI1 vacío, CI2 < 8, CI3 > 8, CI4 con letras
  const casos = [
    { id: 'CN-CLI-01', dni: '45127890', esperado: 201, clase: 'CV1 8 dígitos' },
    { id: 'CN-CLI-02', dni: '', esperado: 422, clase: 'CI1 vacío' },
    { id: 'CN-CLI-03', dni: '4512789', esperado: 422, clase: 'CI2 7 dígitos (límite inferior − 1)' },
    { id: 'CN-CLI-04', dni: '451278901', esperado: 422, clase: 'CI3 9 dígitos (límite superior + 1)' },
    { id: 'CN-CLI-05', dni: '4512789O', esperado: 422, clase: 'CI4 contiene la letra O' },
  ];
  for (const c of casos) {
    it(`${c.id} ${c.clase} → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/clientes', cliente({ numero_documento: c.dni }));
      assert.equal(r.status, c.esperado);
      if (c.esperado === 422) assert.ok(r.cuerpo.errores.numero_documento);
    });
  }
});

describe('Caja negra: registrar cliente — valores límite del nombre (3 a 100 caracteres)', () => {
  const casos = [
    { id: 'CN-CLI-06', largo: 2, esperado: 422 },
    { id: 'CN-CLI-07', largo: 3, esperado: 201 },
    { id: 'CN-CLI-08', largo: 100, esperado: 201 },
    { id: 'CN-CLI-09', largo: 101, esperado: 422 },
  ];
  for (const c of casos) {
    it(`${c.id} nombre de ${c.largo} caracteres → ${c.esperado}`, async () => {
      const r = await srv.peticion('POST', '/api/clientes', cliente({ nombre: 'A'.repeat(c.largo) }));
      assert.equal(r.status, c.esperado);
    });
  }
});

describe('Caja negra: reglas de clientes', () => {
  it('CN-CLI-10 cliente con RUC válido se registra; con RUC de dígito incorrecto no', async () => {
    const ok = await srv.peticion('POST', '/api/clientes', cliente({ tipo_documento: 'RUC', numero_documento: '20131456787', nombre: 'Minimarket Wanka S.A.C.' }));
    assert.equal(ok.status, 201);
    const mal = await srv.peticion('POST', '/api/clientes', cliente({ tipo_documento: 'RUC', numero_documento: '20131456788' }));
    assert.equal(mal.status, 422);
  });

  it('CN-CLI-11 documento duplicado → 409 con mensaje en el campo', async () => {
    const r = await srv.peticion('POST', '/api/clientes', cliente({ numero_documento: '45678912' }));
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.errores.numero_documento, /ya está registrado/);
  });

  it('CN-CLI-12 tipo de documento fuera de la lista → 422', async () => {
    const r = await srv.peticion('POST', '/api/clientes', cliente({ tipo_documento: 'PASAPORTE' }));
    assert.equal(r.status, 422);
    assert.ok(r.cuerpo.errores.tipo_documento);
  });

  it('CN-CLI-13 correo y teléfono opcionales: se aceptan vacíos y se rechazan mal escritos', async () => {
    assert.equal((await srv.peticion('POST', '/api/clientes', cliente({ email: '', telefono: '' }))).status, 201);
    const r = await srv.peticion('POST', '/api/clientes', cliente({ email: 'rosa@', telefono: '12345' }));
    assert.equal(r.status, 422);
    assert.deepEqual(Object.keys(r.cuerpo.errores).sort(), ['email', 'telefono']);
  });
});

describe('Caja negra: ciclo CRUD completo de un cliente', () => {
  it('CN-CLI-14 crear → listar → buscar → editar → eliminar → ya no existe', async () => {
    const creado = await srv.peticion('POST', '/api/clientes', cliente({ numero_documento: '76543210', nombre: 'Pedro Ñaupari Lazo' }));
    assert.equal(creado.status, 201);
    const id = creado.cuerpo.datos.id;

    const lista = await srv.peticion('GET', '/api/clientes');
    assert.ok(lista.cuerpo.datos.some((c) => c.id === id));

    const busqueda = await srv.peticion('GET', `/api/clientes?q=${encodeURIComponent('ñaupari')}`);
    assert.equal(busqueda.status, 200);
    assert.deepEqual(busqueda.cuerpo.datos.map((c) => c.id), [id]);

    const editado = await srv.peticion('PUT', `/api/clientes/${id}`, { ...creado.cuerpo.datos, telefono: '955000111' });
    assert.equal(editado.status, 200);
    assert.equal(editado.cuerpo.datos.telefono, '955000111');

    const eliminado = await srv.peticion('DELETE', `/api/clientes/${id}`);
    assert.equal(eliminado.status, 200);
    assert.equal((await srv.peticion('GET', `/api/clientes/${id}`)).status, 404);
  });

  it('CN-CLI-15 eliminar un cliente que tiene ventas → 409 y sigue existiendo', async () => {
    const r = await srv.peticion('DELETE', '/api/clientes/1');
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error, /venta/);
    assert.equal((await srv.peticion('GET', '/api/clientes/1')).status, 200);
  });

  it('CN-CLI-17 regresión DEF-05: la búsqueda ignora mayúsculas y tildes', async () => {
    await srv.peticion('POST', '/api/clientes', cliente({ nombre: 'Óscar Núñez Huamán' }));
    for (const texto of ['NUÑEZ', 'nunez', 'oscar', 'Huaman']) {
      const r = await srv.peticion('GET', `/api/clientes?q=${encodeURIComponent(texto)}`);
      assert.ok(r.cuerpo.datos.some((c) => c.nombre === 'Óscar Núñez Huamán'), `no encontró con "${texto}"`);
    }
  });

  it('CN-CLI-16 editar o eliminar un id inexistente → 404', async () => {
    assert.equal((await srv.peticion('PUT', '/api/clientes/9999', cliente())).status, 404);
    assert.equal((await srv.peticion('DELETE', '/api/clientes/9999')).status, 404);
  });
});
