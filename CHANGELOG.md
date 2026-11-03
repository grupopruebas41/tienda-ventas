# Historial de versiones

Formato basado en *Keep a Changelog* y versionado semántico (MAYOR.MENOR.PARCHE).

## [1.1.2] — 2026-11-03
### Corregido
- Por recomendación de SonarQube (Reliability, 8 casos): en `public/js/vistas/crud.js` y `public/js/vistas/ventas.js`
  las promesas de los listeners ya no quedan sueltas. Las que consultan la API (`abrir`, `abrirNuevaVenta`, `verVenta`)
  terminan en `.catch()` y avisan el error al usuario; `cargar()`, `eliminar()` y `anular()`, que ya manejan sus errores, se marcan con `void`.
- Por recomendación de SonarQube (Maintainability, Blocker): la prueba A11Y-07 ahora tiene aserciones explícitas
  (foco en el título de la sección y anuncio de "Clientes").

## [1.1.1] — 2026-11-03
### Añadido
- Integración continua con GitHub Actions: `pruebas.yml` (198 pruebas en cada push) y `sonarqube.yml` (análisis en SonarQube Cloud).
- `sonar-project.properties` y script `npm run test:sonar`, que genera la cobertura en formato LCOV (`coverage/lcov.info`).

## [1.1.0] — 2026-11-03
### Añadido — accesibilidad (WCAG 2.2 AA)
- Panel "Accesibilidad": tamaño de texto (100 / 125 / 150 %), alto contraste (≥ 7:1), espaciado de texto amplio,
  reducir animaciones y lectura en voz alta de la sección y de los avisos. Las opciones se recuerdan.
- Atajos de teclado (Alt + Mayús + 1–5, N, B, L, A) y enlace "Saltar al contenido" funcional.
- Lectores de pantalla: anuncio de la sección al navegar, resumen de errores con enlaces a cada campo,
  campos obligatorios anunciados, `autocomplete`, títulos de tabla, total de la venta anunciado.
- Avisos con botón de cierre; los errores no desaparecen solos.
- Pruebas: 18 de contraste (unitarias estáticas) y 21 de accesibilidad E2E.
### Corregido
- DEF-10 a DEF-19 (ver `docs/registro-de-defectos.md`).

## [1.0.0] — 2026-11-02
### Añadido
- Suite de pruebas: 40 unitarias, 35 de caja blanca, 67 de caja negra (API) y 17 E2E (Playwright).
- Reporte de cobertura (`npm run test:cobertura`): 99 % de líneas, 92 % de ramas, 100 % de funciones.
- Registro de defectos y solicitudes de cambio en `docs/`.
### Corregido
- DEF-05 búsqueda con tildes y ñ · DEF-06 respuesta 413 · DEF-07 precio en notación científica ·
  DEF-08 stock hexadecimal · DEF-09 desplazamiento del diálogo de venta.

## [0.2.0] — 2026-11-02
### Añadido
- Frontend: resumen del día, CRUD de clientes, proveedores y productos, registro y anulación de ventas,
  validación en tiempo real, confirmación antes de eliminar, avisos y diseño responsivo.
### Corregido
- DEF-01 diálogo abierto al navegar · DEF-02 desborde del formulario · DEF-03 enlace subrayado ·
  DEF-04 desborde en celular.

## [0.1.0] — 2026-11-02
### Añadido
- API REST con Node.js y base de datos SQLite (clientes, proveedores, productos, ventas).
- Validaciones peruanas (DNI, RUC módulo 11), IGV 18 % en céntimos, reglas de boleta y factura.
