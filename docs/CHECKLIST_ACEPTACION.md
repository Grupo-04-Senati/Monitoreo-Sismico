# Checklist de aceptación del MVP

Criterios del PDF §14 con su evidencia. **Automático** = lo comprueba una prueba o el CI
en cada cambio. **Manual** = hay que mirarlo en la aplicación antes de entregar (la
columna dice qué). Estado al 2026-10-21, versión candidata de la Fase 9.

| # | Criterio (PDF §14) | Evidencia | Cómo se verifica | Estado |
|---|---|---|---|---|
| 1 | Se despliega desde instrucciones documentadas y configuración de entorno | `docs/DESPLIEGUE.md`, `infra/prod/`, `.env.prod.example` | Automático: trabajo `despliegue` del CI levanta todo en modo producción con HTTPS y hace prueba de humo | ✔ |
| 2 | Los eventos muestran proveedor, hora, ubicación, magnitud, profundidad y enlace de procedencia | Módulo Eventos (`DetalleEventoModal`, `FranjaProcedencia`) | Automático: `e2e/03-eventos.spec.ts` abre un sismo y verifica su enlace al USGS | ✔ |
| 3 | La ingesta no duplica al repetirse y registra cada ejecución y error | `tests/ingestion/test_idempotency.py`, `tests/api/test_ingesta_bd.py`, `ingestion_runs` | Automático (motor) + local con base (extremo a extremo) | ✔ |
| 4 | Dashboard, mapa y gráficas respetan filtros y coinciden con la API | Resúmenes calculados en la API (`/events/compact`, `/analytics`, `/dashboard/summary`) | Automático en Eventos: `apps/web/e2e/03-eventos.spec.ts` comprueba que el total en pantalla = API = archivo del USGS. Dashboard y mapa: manual | ✔ Eventos · manual en Dashboard y mapa |
| 5 | Los modelos registran dataset, periodo, features, versión, métricas y limitaciones | `ml_experiments` (dataset, features, métricas, semilla, versiones de librerías, limitaciones), `model_registry` (versión, limitaciones) | Automático: `tests/api/test_ml_bd.py` (local con base) | ✔ |
| 6 | Las estimaciones no se confunden con alertas oficiales | Etiqueta y color violeta, `categoria=estimacion_experimental`, aviso fijo (D18); los avisos son `aviso_interno` (D19) | Automático: `test_estimaciones_bd.py`, `test_alertas_bd.py` + manual visual | ✔ |
| 7 | Las reglas permiten probar condiciones, evitar duplicados y consultar la entrega | Simulación retrospectiva, restricción única sismo/regla, entregas por canal (D19) | Automático: `test_alertas_reglas.py`, `test_alertas_bd.py` | ✔ |
| 8 | Los roles bloquean funciones en la interfaz y en la API | `core/permissions.py`, `RouteGuard` en el frontend | Automático en la API: `test_autorizacion.py` (5 roles × cada ruta, en el CI). En la interfaz: `e2e/02-roles.spec.ts` (Analista y Operador) | ✔ |
| 9 | Los reportes muestran fecha de corte, filtros, fuente y solicitante | `services/reports` (cabecera con metadatos), `report_jobs.requested_by` | Manual: generar un reporte y revisar su cabecera | ✔ (manual) |
| 10 | Existen pruebas, backup probado, guía de operación y procedimiento de incidente | 370+ pruebas, CI; `infra/backup` con simulacro (en el CI); `docs/DESPLIEGUE.md`; `docs/MANUAL_TECNICO.md` §8 | Automático: CI (pruebas + simulacro de restauración) | ✔ |

## Seguridad (PDF §12)

| Punto | Estado |
|---|---|
| HTTPS obligatorio | ✔ Caddy con certificado automático; HSTS (D22) |
| Secretos fuera del repositorio | ✔ `.env*` ignorados; el CI falla si se versiona uno (D21) |
| No arrancar con secretos de desarrollo | ✔ Verificación al arrancar en producción (D21) |
| Autorización en backend y validación de entrada | ✔ Permisos por ruta; Pydantic en todas las entradas |
| CORS restringido, cabeceras de seguridad, CSP | ✔ D21 y D22 |
| Registro de errores sin tokens; auditoría sin secretos | ✔ `registrar_auditoria` filtra secretos; Caddy oculta cookies |
| Política de retención | ✔ Retención configurable con purga protegida (D20) |
| Backups automatizados y simulacro de restauración | ✔ Copia diaria + simulacro en el CI (D22) |
| Monitoreo de fuentes, ingesta, tareas, latencia y entregas | ✔ Estado del sistema y `/health/ready` (D23) |
| Idempotencia y deduplicación | ✔ Ingesta por evento; avisos por sismo y regla |

## Pendiente antes de una entrega formal

- [x] Prueba de interfaz automatizada (E2E): 13 flujos en `apps/web/e2e` (acceso, roles,
      eventos, reglas y avisos, configuración), en el CI en cada cambio.
- [x] Prueba de carga (`docs/CARGA.md`): un proceso atiende 100 usuarios simultáneos con uso
      realista (p95 676 ms, 0 errores).
- [x] Límite de intentos de acceso en Redis, compartido entre procesos (D25).
- [x] Caché del catálogo compacto en el servidor (D26): +60 % de capacidad por proceso.
- [ ] Repetir la prueba de carga en el servidor Linux de producción y medir el escalado con
      varios procesos.
- [x] Accesibilidad automática (PDF §13): axe-core con reglas WCAG 2.1 A/AA en 15 pantallas
      sin hallazgos, uso con teclado y cierre de diálogos con Esc (`e2e/06-accesibilidad.spec.ts`).
- [ ] Revisión manual con un lector de pantalla (NVDA o Narrador) de los flujos principales.
- [x] Muestra real del USGS en el CI (`tests/fixtures`): corren las pruebas de alertas y eventos.
- [x] `react-router` 7.18.4 (`npm audit`: 0 vulnerabilidades); las 17 E2E pasan.
- [ ] Revisar lo que reporte `pip-audit` en el CI (trabajo Seguridad).
- [ ] Validar con especialistas el significado de cada indicador (PDF §6).
- [ ] Copiar las copias de seguridad fuera del servidor de producción.
