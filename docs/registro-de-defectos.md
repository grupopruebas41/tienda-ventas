# Registro de defectos

Defectos reales encontrados durante la ejecución de las pruebas del sistema de ventas.
Cada defecto se corrigió, se volvió a probar y quedó cubierto por una prueba de regresión.

| ID | Módulo / tipo | Descripción | Detectado por | Severidad | Estado | Corrección | Prueba de regresión |
|---|---|---|---|---|---|---|---|
| DEF-01 | Interfaz / navegación | Al cambiar de sección con un formulario abierto, el diálogo seguía abierto y bloqueaba los clics en la nueva vista. | Script de Playwright (clic interceptado por el `<dialog>`) | Media | Cerrado | `navegar()` cierra los diálogos abiertos antes de montar la vista. | E2E-16 |
| DEF-02 | Interfaz / diseño | En el formulario de 2 columnas los cuadros de texto desbordaban el diálogo; al enfocar un campo el contenido se desplazaba y la cabecera quedaba pegada al borde. | Revisión visual de captura | Media | Cerrado | `min-width: 0` en la rejilla y `width: 100%` en los controles. | E2E-02 (captura) |
| DEF-03 | Interfaz / diseño | El enlace "Registrar una venta" con estilo de botón aparecía subrayado. | Revisión visual de captura | Baja | Cerrado | `text-decoration: none` en `a.boton`. | Captura 01-resumen |
| DEF-04 | Interfaz / responsivo | En celular (390 px) la página se desbordaba horizontalmente; el buscador quedaba cortado y los precios se partían en dos líneas. | Revisión visual a 390 px | Media | Cerrado | `minmax(0, 1fr)` en la rejilla principal, `min-width: 0` y `white-space: nowrap` en importes. | E2E-15 |
| DEF-05 | Búsqueda | Buscar "ñaupari" no encontraba a "Pedro Ñaupari Lazo": `LIKE` de SQLite solo ignora mayúsculas en letras ASCII. | CN-CLI-14 (caja negra) | Alta | Cerrado | Función SQL `normalizar()` (minúsculas, sin tildes) en la columna y en el texto buscado. | CN-CLI-17, CN-PRV-08, CB-BD-03 |
| DEF-06 | Fiabilidad / HTTP | Con un cuerpo mayor a 100 KB el servidor cortaba la conexión en lugar de responder 413. | CN-HTTP-04 (caja negra) | Media | Cerrado | Se descarta el exceso y se responde 413 con mensaje. | CN-HTTP-04 |
| DEF-07 | Validación | El precio "1e2" (notación científica) se aceptaba como S/ 100.00. | CN-PRD-08 (clase inválida) | Media | Cerrado | El precio debe cumplir `^\d+(\.\d+)?$`. | CN-PRD-08 |
| DEF-08 | Validación | El stock "0x10" (hexadecimal) se aceptaba como 16. | CN-PRD-14 (clase inválida) | Media | Cerrado | Los enteros deben cumplir `^-?\d+$`. | CN-PRD-14 |
| DEF-09 | Interfaz / diseño | En "Nueva venta" el contenido aparecía desplazado ~30 px a la izquierda (título pegado al borde, pie cortado). | Revisión de la captura de E2E-12 | Media | Cerrado | Causa raíz: radios ocultos Boleta/Factura con `position: absolute` fuera del diálogo. Se contuvieron dentro del control. | E2E-17 |

## Resumen

| Severidad | Cantidad |
|---|---|
| Alta | 1 |
| Media | 7 |
| Baja | 1 |
| **Total** | **9 (todos cerrados)** |

| Técnica que lo detectó | Defectos |
|---|---|
| Caja negra (API) | DEF-05, DEF-06, DEF-07, DEF-08 |
| E2E / revisión visual de la interfaz | DEF-01, DEF-02, DEF-03, DEF-04, DEF-09 |
| Caja blanca / unitarias | — (sirvieron como red de seguridad: confirmaron que las correcciones no rompieron nada) |
