-- =====================================================================
--  Base de datos: tienda_ventas  (SQLite 3)
--  Empresa caso de estudio: Distribuidora El Mantaro S.A.C. (Huancayo)
--  Los importes se guardan en CÉNTIMOS (INTEGER) para evitar errores de
--  redondeo. Ej.: S/ 12.50 se guarda como 1250.
-- =====================================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_documento    TEXT    NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC')),
  numero_documento  TEXT    NOT NULL UNIQUE,
  nombre            TEXT    NOT NULL,
  email             TEXT,
  telefono          TEXT,
  direccion         TEXT,
  creado_en         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  actualizado_en    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS proveedores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ruc             TEXT    NOT NULL UNIQUE,
  razon_social    TEXT    NOT NULL,
  contacto        TEXT,
  telefono        TEXT    NOT NULL,
  email           TEXT,
  direccion       TEXT,
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  actualizado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS productos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo           TEXT    NOT NULL UNIQUE,
  nombre           TEXT    NOT NULL,
  categoria        TEXT    NOT NULL,
  precio_centimos  INTEGER NOT NULL CHECK (precio_centimos > 0),
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo     INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  proveedor_id     INTEGER NOT NULL REFERENCES proveedores (id) ON DELETE RESTRICT,
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  actualizado_en   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_comprobante   TEXT    NOT NULL CHECK (tipo_comprobante IN ('BOLETA', 'FACTURA')),
  serie              TEXT    NOT NULL,
  correlativo        INTEGER NOT NULL,
  cliente_id         INTEGER REFERENCES clientes (id) ON DELETE RESTRICT,
  subtotal_centimos  INTEGER NOT NULL,
  igv_centimos       INTEGER NOT NULL,
  total_centimos     INTEGER NOT NULL CHECK (total_centimos > 0),
  estado             TEXT    NOT NULL DEFAULT 'EMITIDA' CHECK (estado IN ('EMITIDA', 'ANULADA')),
  fecha              TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (serie, correlativo)
);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id                  INTEGER NOT NULL REFERENCES ventas (id) ON DELETE CASCADE,
  producto_id               INTEGER NOT NULL REFERENCES productos (id) ON DELETE RESTRICT,
  cantidad                  INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_centimos  INTEGER NOT NULL,
  importe_centimos          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente      ON ventas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta       ON venta_detalle (venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_producto    ON venta_detalle (producto_id);
