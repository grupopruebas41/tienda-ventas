'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const CARPETA_BD = path.join(__dirname, '..', '..', 'database');

function leerScript(nombre) {
  return fs.readFileSync(path.join(CARPETA_BD, nombre), 'utf8');
}

/** Minúsculas y sin tildes: "Ñaupari Núñez" → "naupari nunez" (DEF-05). */
function normalizarTexto(texto) {
  if (texto === null || texto === undefined) return null;
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tieneTablas(db) {
  const fila = db
    .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'clientes'")
    .get();
  return fila.total > 0;
}

/**
 * Abre (o crea) la base de datos SQLite.
 * @param {object} opciones
 * @param {string} opciones.archivo  Ruta del archivo .db o ':memory:' para pruebas.
 * @param {boolean} opciones.datosDemo  Si es true carga database/seed.sql cuando la BD es nueva.
 */
function abrirBaseDatos({ archivo = ':memory:', datosDemo = true } = {}) {
  if (archivo !== ':memory:') {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
  }
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA foreign_keys = ON;');
  // Función SQL para búsquedas sin distinguir mayúsculas ni tildes (DEF-05)
  db.function('normalizar', { deterministic: true }, normalizarTexto);
  if (archivo !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

  if (!tieneTablas(db)) {
    db.exec(leerScript('schema.sql'));
    if (datosDemo) db.exec(leerScript('seed.sql'));
  }
  return db;
}

/** Ejecuta fn dentro de una transacción: si algo falla se revierte todo. */
function enTransaccion(db, fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { abrirBaseDatos, enTransaccion, normalizarTexto };
