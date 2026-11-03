# Sistema de ventas — Distribuidora El Mantaro S.A.C.

Aplicación web para registrar las ventas de una tienda peruana (caso de estudio de la
**PA3 de Pruebas y Calidad de Software**). Incluye CRUD de **clientes, proveedores y
productos**, registro y anulación de **ventas** (boleta/factura con IGV 18 %) y una batería
de **pruebas unitarias, de caja blanca, de caja negra y de extremo a extremo (E2E)**.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3 y JavaScript (módulos ES) — sin frameworks |
| Backend | Node.js (`node:http`) — API REST en `/api` |
| Base de datos | SQLite (`node:sqlite`, integrado en Node.js) — archivo `database/tienda.db` |
| Pruebas | `node:test` + `node:assert` (unitarias, caja blanca, caja negra) y Playwright (E2E) |

## Accesibilidad

El sistema cumple los criterios de **WCAG 2.2 nivel AA** que se prueban en `tests/e2e/accesibilidad.test.js`
y `tests/unitarias/contraste.test.js`. En el menú lateral, el botón **Accesibilidad** (o `Alt + Mayús + A`) permite:

- Cambiar el tamaño del texto (Normal, Grande, Muy grande).
- Activar **alto contraste** (texto blanco y amarillo sobre negro).
- Aumentar el espacio entre letras y líneas (dislexia, baja visión).
- Reducir animaciones.
- **Leer en voz alta** la sección y los avisos.

Atajos de teclado: `Alt + Mayús + 1…5` (secciones), `N` (nuevo registro), `B` (buscar), `L` (leer en voz alta).
Funciona con lectores de pantalla (NVDA, JAWS, TalkBack): anuncia la sección, los errores y los avisos.

## Requisitos

- **Node.js 22.13 o superior** (recomendado Node.js 24 LTS). Verifica con `node -v`.
- No hace falta instalar MySQL ni XAMPP: la base de datos SQLite se crea sola.

## Cómo ejecutar

```bash
# 1. Entrar a la carpeta del proyecto
cd tienda-ventas

# 2. Iniciar el servidor (crea la BD con datos de ejemplo la primera vez)
npm start

# 3. Abrir en el navegador
http://localhost:3000
```

Para reiniciar la base de datos con los datos de ejemplo: `npm run reset-db`.
Para usar otro puerto: `PUERTO=4000 npm start` (en Windows PowerShell: `$env:PUERTO=4000; npm start`).

## Cómo ejecutar las pruebas

```bash
npm test                  # unitarias + caja blanca + caja negra (160 casos)
npm run test:unitarias    # 58 casos (incluye 18 de contraste de colores)
npm run test:caja-blanca  # 35 casos
npm run test:caja-negra   # 67 casos
npm run test:cobertura    # todo lo anterior + reporte de cobertura de código

# Pruebas E2E de la interfaz (17) y de accesibilidad (21) — requiere instalar Playwright una vez:
npm install
npx playwright install chromium
npm run test:e2e
```

Las pruebas usan una base de datos **en memoria**, así que no modifican `database/tienda.db`.

## Estructura

```
tienda-ventas/
├── database/
│   ├── schema.sql            # Tablas: clientes, proveedores, productos, ventas, venta_detalle
│   └── seed.sql              # Datos de ejemplo (ficticios)
├── public/                   # FRONTEND
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js            # Enrutador por hash (#/clientes)
│       ├── accesibilidad.js  # Preferencias, voz, anuncios y atajos de teclado
│       ├── api.js            # Cliente HTTP (fetch)
│       ├── ui.js             # Formulario modal, confirmación, avisos, tablas
│       └── vistas/           # resumen, ventas, clientes, proveedores, productos
├── src/                      # BACKEND
│   ├── server.js             # Punto de entrada (npm start)
│   ├── app.js                # Rutas de la API y manejo de errores
│   ├── shared/validaciones.js# Reglas compartidas por backend y frontend (DNI, RUC, precio…)
│   ├── dominio/calculos.js   # IGV, totales, número de comprobante
│   ├── servicios/            # Reglas de negocio
│   ├── repositorios/         # SQL parametrizado
│   ├── http/                 # Router, JSON, archivos estáticos
│   └── db/conexion.js        # Conexión SQLite y transacciones
├── tests/
│   ├── unitarias/            # PU-xx  funciones aisladas y servicios con dobles de prueba
│   ├── caja-blanca/          # CB-xx  caminos independientes y ramas (complejidad ciclomática)
│   ├── caja-negra/           # CN-xx  partición de equivalencia y valores límite sobre la API
│   └── e2e/                  # E2E-xx interfaz y A11Y-xx accesibilidad, con navegador real
├── docs/
│   ├── Informe_PA3_Pruebas_Software.docx
│   ├── registro-de-defectos.md
│   ├── solicitudes-de-cambio.md
│   └── evidencias/           # Capturas y salidas de consola de las pruebas
├── CHANGELOG.md
└── package.json
```

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/clientes?q=` | Lista y busca (sin distinguir mayúsculas ni tildes) |
| GET | `/api/clientes/:id` | Obtiene uno |
| POST | `/api/clientes` | Registra (201) — 422 si hay errores, 409 si el documento ya existe |
| PUT | `/api/clientes/:id` | Actualiza |
| DELETE | `/api/clientes/:id` | Elimina — 409 si tiene ventas |
| … | `/api/proveedores`, `/api/productos` | Mismas 5 operaciones. `GET /api/productos?stockBajo=1` |
| GET | `/api/ventas`, `/api/ventas/:id` | Lista y detalle |
| POST | `/api/ventas` | Registra `{ tipo_comprobante, cliente_id, items: [{ producto_id, cantidad }] }` |
| POST | `/api/ventas/:id/anular` | Anula y repone stock |
| GET | `/api/resumen` | Cifras del día |

## Reglas de negocio

- DNI: 8 dígitos. RUC: 11 dígitos, prefijo 10/15/16/17/20 y dígito verificador módulo 11 (SUNAT).
- Los precios incluyen IGV (18 %); los importes se guardan en céntimos para evitar errores de redondeo.
- La **factura** exige un cliente con RUC. La **boleta** mayor a S/ 700.00 exige identificar al cliente.
- No se elimina un cliente con ventas, un proveedor con productos ni un producto vendido.
- La venta descuenta stock dentro de una transacción; la anulación lo repone.

Los datos de ejemplo (empresas, RUC, personas) son ficticios.
