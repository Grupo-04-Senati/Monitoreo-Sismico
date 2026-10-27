# Manual técnico

Referencia para quien opera o continúa la plataforma. Lo que no está aquí está en:
`docs/DECISIONES.md` (el porqué de cada decisión, D1–D31), `docs/CONTRATOS.md` (API y
reglas compartidas), `docs/DESPLIEGUE.md` (instalación, copias y recuperación) y
`docs/HANDOFF.md` (entorno local y pendientes).

## 1. Qué es

Plataforma empresarial **privada** de monitoreo sísmico para el personal de empresas con
activos en zonas sísmicas. Usa sismos ya ocurridos y publicados por una fuente (hoy el
USGS). **No predice sismos ni es un sistema público de alerta**: sus avisos son internos
y sus estimaciones de ML son experimentales; lo oficial lo comunican IGP e INDECI.

## 2. Arquitectura

```
Navegador ──HTTPS──► Caddy ──┬── /            → frontend compilado (React + Vite)
                             └── /api, /health → API FastAPI ──► PostgreSQL
                                                    ▲
             Celery beat ──► Redis ──► Celery worker ┘  (sincroniza la fuente)
             Copias: pg_dump diario ──► carpeta de copias (vigilada por el monitoreo)
```

| Carpeta | Contenido |
|---|---|
| `apps/web` | Frontend: un módulo por pantalla en `src/modules/<módulo>` (types, services, schemas, components) |
| `services/api` | API: `routers/` (HTTP), `services/` (lógica), `db/models.py`, `migrations/` (Alembic) |
| `services/ingestion` | Conector USGS, normalización e idempotencia (lógica pura) |
| `services/ml` | Variables, entrenamiento, evaluación e inferencia (scikit-learn) |
| `infra/prod`, `infra/backup` | Despliegue de producción y scripts de copias |
| `tests/` | Pruebas de API, ingesta y ML (pytest) |

## 3. Flujos principales

1. **Ingesta**: beat programa la sincronización → el worker consulta el USGS por tramos,
   normaliza y guarda sin duplicar (`source_id` + `external_id`). En las sincronizaciones
   normales también trae lo que el USGS **corrigió** en los últimos 60 días y lo aplica,
   guardando la versión anterior (D27). Cada ejecución queda en `ingestion_runs` con sus
   registros (nuevos, corregidos, repetidos) y errores.
2. **Avisos**: tras cada sincronización con sismos nuevos, el motor evalúa las reglas
   activas (magnitud, profundidad, zona), deduplica por sismo y regla, respeta la espera
   entre avisos y deja el aviso pendiente de aprobación o lo entrega (D19).
3. **Analítica**: dataset versionado (instantánea de eventos con reglas de limpieza) →
   experimento de ML con semilla y partición temporal → modelo aprobado → estimación
   semanal con intervalo empírico, en revisión hasta que un Administrador la publique.
4. **Trazabilidad**: toda acción administrativa pasa por `registrar_auditoria` y queda en
   `audit_logs`, tabla protegida por trigger (solo inserción salvo purga de retención).

## 4. Datos

Tablas: `users`, `roles`, `data_sources`, `ingestion_runs`, `ingestion_logs`,
`seismic_events`, `report_jobs`, `audit_logs`, `datasets`, `dataset_events`,
`ml_experiments`, `model_registry`, `risk_estimates`, `alert_rules`, `alerts`,
`alert_deliveries`, `system_settings`.

- Fechas en UTC en la base; la interfaz las muestra en UTC-5.
- Migraciones: `alembic upgrade head` (la API de producción lo hace al arrancar). Cada
  migración tiene su `downgrade` y el CI prueba subir, bajar y volver a subir.
- Tablas con trigger de protección: `audit_logs`, `datasets`, `dataset_events`,
  `ml_experiments` y `risk_estimates`. Qué permite cada una (p. ej. aprobar un dataset o
  publicar una estimación) está en D14, D16, D17 y D18.

## 5. Roles

| Rol | Puede |
|---|---|
| Administrador | Todo: usuarios, fuentes, activar reglas, aprobar modelos, publicar estimaciones, configuración, purga |
| Analista | Datos, análisis, datasets, modelos y estimaciones; reportes |
| Operador de alertas | Reglas (sin activarlas) y centro de alertas; reportes |
| Auditor | Consultar y exportar la auditoría; vistas de lectura |
| Solo lectura | Dashboard, eventos, mapa y reportes |

La autorización se aplica en la API (`core/permissions.py`) y la interfaz oculta lo que
el rol no puede usar. `tests/api/test_autorizacion.py` prueba los 5 roles en cada ruta.

## 6. Configuración

- **Entorno** (`.env`, `infra/prod/.env.prod`): secretos, base, CORS, cookies, SMTP. Con
  `ENV=production` la API no arranca con valores de desarrollo (D21).
- **Parámetros** (pantalla Configuración, D20): vigencia de reportes, umbral de datos
  desactualizados y retención de la auditoría. Cada cambio se audita.

## 7. Monitoreo

Pantalla **Configuración → Estado del sistema** (`GET /api/v1/monitoring`, solo
Administrador) y `GET /health/ready` para monitores externos (200 si la base responde,
503 si no; sin datos sensibles). Comprobaciones y umbrales (`services/monitoreo.py`, D23):

| Comprobación | Correcto | Revisar | Atención |
|---|---|---|---|
| Base de datos | responde en < 200 ms | más lento | (falla `/health/ready`) |
| Ingesta (por fuente) | retraso ≤ 2 × frecuencia + 5 min | ≤ 6 × frecuencia + 5 min | más, o nunca sincronizó |
| Ejecuciones de ingesta | sin fallos en 24 h | fallidas o colgadas > 30 min | — |
| Avisos internos | sin entregas fallidas ni esperas largas | entregas fallidas o pendientes > 60 min | — |
| Latencia de la API | p95 ≤ 1000 ms y sin 5xx | p95 mayor o errores 5xx | — |
| Límite de intentos de acceso | en Redis, o en memoria con un proceso | en memoria con varios procesos | — |
| Copias de seguridad | última ≤ 26 h | ≤ 50 h | más, o ninguna |

La latencia se mide en el proceso de la API desde su último arranque (últimas 2000
peticiones a `/api`). Conviene apuntar un monitor externo (UptimeRobot, Healthchecks u
otro de la empresa) a `https://<dominio>/health/ready` cada 1–5 minutos.

## 8. Procedimiento de incidente

1. **Detectar**: monitor externo, pantalla de estado o aviso de un usuario.
2. **Clasificar**:
   - *Seguridad* (acceso indebido, secreto expuesto): prioridad máxima.
   - *Servicio caído* (web o API no responden).
   - *Datos atrasados* (ingesta detenida) o *entregas fallidas* de avisos.
3. **Contener**:
   - Seguridad: suspender las cuentas implicadas (Usuarios), rotar `API_SECRET_KEY`
     (cierra todas las sesiones) y la contraseña de la base, revisar la Auditoría
     filtrando por usuario y fechas, y exportarla como evidencia.
   - Servicio caído: `docs/DESPLIEGUE.md` §5.1; si la base está dañada, §5.3.
   - Ingesta atrasada: `logs worker beat`; sincronización manual desde Fuentes de datos.
   - Entregas fallidas: revisar SMTP en Configuración y reintentar en el Centro de alertas.
4. **Comunicar**: avisar a los usuarios internos del alcance y del tiempo estimado.
   Recordar que la plataforma no sustituye a IGP/INDECI: ante un sismo real, la fuente
   oficial manda.
5. **Cerrar**: comprobar el estado del sistema en verde, dejar constancia (qué pasó,
   impacto, causa, acciones) y abrir las tareas de mejora en el repositorio.

## 9. Pruebas

```bash
pytest tests -q            # desde la raíz, con services/api/.env apuntando a la base local
cd apps/web && npm run build
```

El CI (`.github/workflows/ci.yml`) corre en cada PR: backend sobre una base vacía,
frontend, seguridad y despliegue completo con HTTPS, prueba de humo y simulacro de
restauración. Las pruebas que necesitan sismos reales solo corren en local.
