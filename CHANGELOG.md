# Historial de versiones

Formato basado en *Keep a Changelog* y versionado semántico (MAYOR.MENOR.PARCHE).

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
