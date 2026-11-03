# Control de cambios

Proceso aplicado (Sesión 11): **solicitud → evaluación → aprobación → implementación → verificación**.
Cada cambio se implementó en una rama de Git, se verificó con la suite de pruebas
completa (prueba de regresión) y luego se integró a `main`.

| N.° | Solicitud | Origen | Evaluación (impacto) | Decisión | Implementación | Verificación | Versión |
|---|---|---|---|---|---|---|---|
| SC-01 | Cerrar diálogos al cambiar de sección | DEF-01 | Bajo: solo `public/js/app.js` | Aprobado | Commit en `main` (frontend) | E2E-16 | 0.2.0 |
| SC-02 | Corregir desbordes del diseño (formulario, celular, enlace-botón) | DEF-02, DEF-03, DEF-04 | Bajo: solo `styles.css` | Aprobado | Commit en `main` (frontend) | E2E-15 + capturas | 0.2.0 |
| SC-03 | Búsqueda sin distinguir mayúsculas ni tildes | DEF-05 | Medio: conexión BD + 3 repositorios | Aprobado | Rama `pruebas/suite-y-correcciones` | CN-CLI-14, CN-CLI-17, CN-PRV-08, CB-BD-03 | 1.0.0 |
| SC-04 | Responder 413 en cuerpos grandes | DEF-06 | Bajo: `utilidadesHttp.js` | Aprobado | Rama `pruebas/suite-y-correcciones` | CN-HTTP-04, CB-HTTP-01..05 | 1.0.0 |
| SC-05 | Formato estricto de precio y enteros | DEF-07, DEF-08 | Medio: validaciones compartidas front/back | Aprobado | Rama `pruebas/suite-y-correcciones` | CN-PRD-01..14, PU-VAL-10..12 | 1.0.0 |
| SC-06 | Corregir desplazamiento del diálogo de venta | DEF-09 | Bajo: `styles.css` | Aprobado | Rama `pruebas/suite-y-correcciones` | E2E-17 | 1.0.0 |

Para ver el historial completo: `git log --oneline --graph --all` y `git tag`.
