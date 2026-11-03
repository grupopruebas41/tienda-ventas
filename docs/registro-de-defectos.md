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

## Versión 1.1.0 — auditoría de accesibilidad (WCAG 2.2 AA)

| ID | Criterio WCAG | Descripción | Detectado por | Severidad | Estado | Corrección | Prueba de regresión |
|---|---|---|---|---|---|---|---|
| DEF-10 | 1.4.3 Contraste | La etiqueta verde de stock y "Emitida" tenía contraste 4.36:1 (mínimo 4.5:1). | PU-A11Y-09 (contraste estático) | Media | Cerrado | Verde más oscuro `#256b4d` (5.56:1). | PU-A11Y-09 |
| DEF-11 | 1.4.11 Contraste no textual | El borde de los cuadros de texto tenía 1.79:1 (mínimo 3:1): con baja visión no se distinguía dónde escribir. | PU-A11Y-15 | Alta | Cerrado | Token `--borde-control` `#767f99` (3.99:1). | PU-A11Y-15 |
| DEF-12 | 2.4.1 Saltar bloques | El enlace "Saltar al contenido" cambiaba la dirección a `#contenido` y el sistema mostraba "Resumen": la persona perdía la sección donde estaba. | A11Y-08 (solo teclado) | Alta | Cerrado | El enlace mueve el foco al título; el enrutador ignora hashes que no son rutas. | A11Y-08 |
| DEF-13 | 2.4.7 Foco visible | El indicador de foco usaba `box-shadow`, que desaparece en el modo de alto contraste de Windows. | A11Y-11 | Alta | Cerrado | Foco con `outline` de 3 px. | A11Y-11 |
| DEF-14 | 2.2.1 Tiempo ajustable | Los avisos de error desaparecían a los 6 s sin poder pausarlos ni cerrarlos. | A11Y-12 | Media | Cerrado | Los errores permanecen hasta cerrarlos; las confirmaciones se pausan con el puntero o el foco. | A11Y-12 |
| DEF-15 | 1.3.1, 1.3.5, 4.1.3 | Para lectores de pantalla: los campos obligatorios no se anunciaban, faltaba `autocomplete`, las tablas no tenían título y los errores no se anunciaban como alerta. | A11Y-02, 03, 05, 06 | Media | Cerrado | `aria-required`, `autocomplete`, `<caption>`, `role="alert"` y región de anuncios. | A11Y-02, 03, 05, 06 |
| DEF-16 | 2.4.3 Orden del foco | Al cambiar de sección el foco no se movía ni se anunciaba la nueva sección. | A11Y-07 | Media | Cerrado | El foco va al título y se anuncia "Sección Clientes, 4 clientes". | A11Y-07 |
| DEF-17 | 2.4.3 | (Código nuevo) si se usaba un atajo justo después de cambiar de sección, el foco "saltaba" de vuelta al título. | A11Y-10 | Media | Cerrado | Solo se mueve el foco si la persona no lo movió mientras cargaba la sección. | A11Y-10 |
| DEF-18 | 4.1.3 | (Regresión) Al añadir el botón ✕ a los avisos, el texto anunciado incluía el símbolo "✕". | E2E-04 (regresión) | Baja | Cerrado | Solo el texto del mensaje se anuncia; el símbolo es `aria-hidden`. | E2E-04, A11Y-05 |
| DEF-19 | 1.4.10 Reajuste | En celular con texto "Muy grande", la opción "Muy grande" del panel quedaba cortada fuera de la pantalla. | Revisión visual a 390 px | Media | Cerrado | El selector se acomoda en varias filas. | A11Y-21 |

## Resumen

| Severidad | v1.0.0 | v1.1.0 | Total |
|---|---|---|---|
| Alta | 1 | 3 | 4 |
| Media | 7 | 6 | 13 |
| Baja | 1 | 1 | 2 |
| **Total** | **9** | **10** | **19 (todos cerrados)** |

| Técnica que lo detectó | Defectos |
|---|---|
| Caja negra (API) | DEF-05, DEF-06, DEF-07, DEF-08 |
| E2E / revisión visual de la interfaz | DEF-01, DEF-02, DEF-03, DEF-04, DEF-09 |
| Caja blanca / unitarias | — en v1.0.0 (red de seguridad); en v1.1.0 la prueba estática de contraste halló DEF-10 y DEF-11 |
| Pruebas de accesibilidad E2E | DEF-12 a DEF-17 (y la revisión visual a 390 px: DEF-19) |
| Regresión (suite existente) | DEF-18 |
