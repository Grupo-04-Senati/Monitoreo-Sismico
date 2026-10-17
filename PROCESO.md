# PROCESO — Sismora: fases de desarrollo

> Tabla viva. Cada fase se cierra con su criterio de "terminada" verificado, y se detiene para el **commit y push manual** de la persona responsable (nunca de su IA).
> Estados: ⬜ pendiente · 🔄 en curso · ✅ hecha (verificada por el usuario) · 🟡 hecha sin verificar en entorno real
> Última actualización: 2026-10-15

## Resumen

| Fase | Nombre | PDF | Estado |
|---|---|---|---|
| 0 | Decisiones, repo, esqueleto y despliegue vacío | F0 + F1 | 🔄 Integración de las dos bases en curso (ver capas y checklist) |
| 1 | Identidad, roles y auditoría | F2 | ⬜ |
| 2 | Ingesta y catálogo de eventos (USGS) | F3 | ⬜ |
| 3 | Eventos, mapa y dashboard | F4 | ⬜ |
| 4 | Análisis estadístico, calidad de datos y datasets | F4 + F5 | ⬜ |
| 5 | Reglas y centro de alertas | F7 | ⬜ |
| 6 | Laboratorio ML y estimaciones experimentales | F6 | ⬜ |
| 7 | Reportes y administración | F8 | ⬜ |
| 8 | Endurecimiento, pruebas, backup y manuales | F9 | ⬜ |

Cambios frente al PDF: despliegue temprano (F0); Fases 4 y 5 del PDF se unen (análisis + calidad de datos); alertas antes que ML (D3).

## Protocolo de cada fase

1. **Inicio:** verificación cruzada de requisitos del PDF y de `CONTEXTO.md` contra los entregables; se anota qué entra y qué no.
2. **Desarrollo** con pruebas (backend contra PostgreSQL real; frontend con Vitest).
3. **Cierre:** correr toda la suite, `alembic check`, build del frontend; actualizar `CONTEXTO.md`, `PROCESO.md` y `DOCUMENTACION.md`.
4. **Exposición:** anotar en `EXPOSICION.md` las preguntas probables que surgieron en la fase.
5. **Alto:** resumen para el usuario (qué cambió, qué revisar, qué no se verificó). El usuario revisa, hace commit y push, y confirma.
6. Rama por tarea (`fase-N-modulo-descripcion`), PR hacia `main` con revisión de otra persona y CI en verde (ver `CONTRIBUTING.md`).

## Criterio de "terminada" por fase

El alcance de cada fase está en el documento base (`docs/referencia/`, §9) y en `CONTEXTO.md` (decisiones y agregados §8). Aquí solo el criterio que la cierra.

| Fase | Entregables clave | Terminada cuando |
|---|---|---|
| 0 | Esqueleto del monorepo, CI, despliegue vacío | La web desplegada muestra el estado de la API desplegada, la API consulta la base y el CI pasa |
| 1 | Login (cookie HttpOnly + anti-CSRF), 5 roles, matriz de permisos, auditoría de solo inserción | La matriz pasa para todos los endpoints, un endpoint sin fila hace fallar la suite y `audit_logs` rechaza UPDATE/DELETE |
| 2 | Adaptador USGS, deduplicación, sincronización incremental, `ingestion_runs`, zonas de Perú, endpoint de cron protegido | Repetir la ingesta no duplica, cada ejecución y error queda registrado y hay datos reales con procedencia |
| 3 | Eventos (tabla y ficha), mapa, dashboard, CSV básico | Dashboard, mapa y gráficas coinciden con la API bajo los mismos filtros y cada gráfica muestra unidad, periodo, filtros, muestra, fuente y hora |
| 4 | Análisis estadístico, informe de calidad, datasets versionados, monitor de frescura | Un dataset publicado es reproducible y el informe de calidad se genera |
| 5 | Reglas con simulación retrospectiva, centro de alertas, aprobación, app + correo, acuse y escalamiento, procedimiento de incidente | Una regla de prueba dispara una alerta que se aprueba, se entrega, se acusa y queda en auditoría; reintentar no duplica |
| 6 | Pipeline de ML (target D2), baseline, regresión lineal, ficha del modelo, estimaciones experimentales | Experimentos reproducibles, comparados con el baseline en la misma partición, y ninguna estimación puede enviarse como alerta oficial |
| 7 | Reportes (CSV/XLSX/PDF), resumen ejecutivo, configuración, retención | Un reporte es reproducible y su descarga está autorizada por rol |
| 8 | Pruebas de aceptación por rol, carga, accesibilidad, seguridad, backup y restauración probados, manuales, `EXPOSICION.md` completo | Se cumplen los criterios del MVP (PDF §14) verificados en el despliegue real |

## Integración de las dos bases (Fase 0)

El grupo ya tenía una interfaz de los 13 módulos con datos de ejemplo; el repo original de Sismora tenía la base de backend, el CI y la documentación de equipo. Se unen por capas, cada una en su PR. Regla (D13): donde la variabilidad es mínima, se conserva lo del grupo.

| Capa | Contenido | Estado |
|---|---|---|
| 1 | Documentos de equipo, plantilla de PR, CODEOWNERS y CI web. No toca código del grupo | 🟡 en PR, sin verificar en GitHub |
| 2 | Higiene: quitar `tsconfig.tsbuildinfo` del repo y las cuentas simuladas del README al llegar el login real | ⬜ |
| 3 | Backend base: configuración segura, errores, correlation ID, migración 0001, pruebas con PostgreSQL real y CI de API (síncrono, con Celery + Redis del grupo) | ⬜ (existe y está verificada en el repo original; falta traerla y adaptarla a las rutas del grupo) |
| 4 | Componentes puntuales (etiquetas de las 4 categorías, pantalla de estado, pruebas web) y despliegue vacío en Vercel + Render | ⬜ |

## Checklist de la Fase 0 (estado al 2026-10-16)

| Criterio | Estado |
|---|---|
| Decisiones D1–D13 cerradas (D12 y D13 propuestas por la integración; el grupo las revisa en el PR) | 🟡 |
| Monorepo con la estructura del PDF §5 | ✅ |
| Interfaz de los 13 módulos con datos de ejemplo | 🟡 compila (build verificado en una copia temporal, 2026-10-16); sin pruebas; no probada módulo por módulo en el navegador |
| Documentos de equipo (capa 1) | 🟡 en este PR |
| CI web (capa 1) | 🟡 escrito; se verifica al abrir el PR |
| Backend base con pruebas (capa 3) | ⬜ |
| Despliegue vacío en Vercel + Render (capa 4) | ⬜ |
| **Terminada cuando:** la web desplegada muestra el estado de la API desplegada, la API consulta la base y el CI pasa | ⬜ |

## Bitácora de cierres

| Fase | Fecha de cierre | Pruebas (back / front) | Verificado por el usuario | Commit |
|---|---|---|---|---|
| — | — | — | — | — |
