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
| SC-07 | Hacer el sistema usable por personas con discapacidad (nuevo requisito RF-12 / RNF-09) | Solicitud del usuario: la tienda tiene personal con discapacidad | Alto: HTML, CSS, 6 archivos JS, nuevas pruebas | Aprobado | Rama `feature/accesibilidad` | 18 PU-A11Y + 21 A11Y + regresión completa | 1.1.0 |
| SC-08 | Corregir fallas de accesibilidad de la auditoría | DEF-10 a DEF-16 | Medio: CSS, enrutador, componentes | Aprobado | Rama `feature/accesibilidad` | A11Y-02 a A11Y-12, PU-A11Y-09 y 15 | 1.1.0 |
| SC-09 | Corregir defectos del código nuevo | DEF-17 a DEF-19 | Bajo | Aprobado | Rama `feature/accesibilidad` | A11Y-10, E2E-04, A11Y-21 | 1.1.0 |
| SC-10 | Corregir las 9 observaciones de SonarQube (promesas sin manejar y prueba sin aserciones) | Análisis de SonarQube | Bajo: `crud.js`, `ventas.js` y una prueba E2E | Aprobado | Rama `fix/sonarqube` | 198 pruebas (160 + 38 E2E) y 0 issues en SonarQube | 1.1.2 |
| SC-11 | Eliminar la duplicación de los servicios CRUD y cubrir las ramas faltantes | Métricas de SonarQube: duplicación 1.6 % y cobertura de condiciones 92.0 % | Medio: 3 servicios + `crudServicio.js` nuevo; 24 pruebas nuevas | Aprobado | Rama `refactor/duplicacion-y-cobertura` | 222 pruebas (184 + 38 E2E), duplicación 0.0 %, cobertura 99.9 % (condiciones 99.8 %) y 0 issues | 1.1.3 |

Para ver el historial completo: `git log --oneline --graph --all` y `git tag`.
