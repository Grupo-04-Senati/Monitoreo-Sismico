# CONTRATOS — Sismora

Contratos estables entre frontend, backend e ingesta. **Si algo aquí cambia, hay que
avisar a todo el equipo** (son los acuerdos compartidos). El detalle de cada endpoint vive
en la propia API (`/api/v1/docs` con `API_DEBUG=true`).

## 1. Prefijo y versión

- Todas las rutas cuelgan de **`/api/v1`** (`services/api/app/main.py`).
- Versión actual: `0.1.0`.

## 2. Respuestas paginadas

Formato estable:

```json
{ "items": [ ... ], "total": 123, "page": 1, "page_size": 25 }
```

- `items`: la página de resultados.
- `total`: total de coincidencias con el filtro (no de la página).
- `page` (>= 1), `page_size` (1..1000 en eventos; el frontend pide páginas de 1000).

Algunas listas no paginadas (`/sources`, runs, logs) devuelven solo `{ items, total }`.
Ver `services/api/app/schemas/*.py` (`EventListOut`, `ReportListOut`, `SourceListOut`, ...).

## 3. Errores

- Formato estándar de FastAPI: `{ "detail": "<mensaje>" }`.
- **Sin datos sensibles**: nunca se devuelve hash, token, contraseña ni si un usuario existe.
- `401 "No autenticado"` — token ausente/ inválido o cuenta no activa.
- `403 "No tiene permisos para esta acción"` — autorización fallida.
- `404` — recurso inexistente. `410` — recurso expirado/eliminado (reportes).
- Cada respuesta lleva el encabezado `X-Correlation-ID` (se propaga si el cliente lo manda).

## 4. Autenticación y autorización

- Sesión con **JWT Bearer** (`Authorization: Bearer <token>`) **o** cookie `access_token`
  (HttpOnly, para el navegador).
- La autorización se aplica **siempre** en el backend con `require_role()` /
  `require_permission()` (`app/core/permissions.py`). Ocultar en el frontend **no protege**.
- Roles (código en inglés, etiqueta en pantalla en español):

  | Código | Etiqueta |
  |---|---|
  | `admin` | Administrador |
  | `analyst` | Analista |
  | `alert_operator` | Operador de alertas |
  | `auditor` | Auditor |
  | `viewer` | Solo lectura |

- La matriz de permisos (`PERMISSIONS`) es la fuente de verdad; `PERMISSION_MATRIX` es la
  proyección "Ver / Operar" que se muestra en el informe.

## 5. Auditoría — `registrar_auditoria`

```python
registrar_auditoria(
    actor_id, action, entity_type, entity_id,
    before, after, correlation_id,
) -> None
```

- **Firma estable** (mantenerla). Campos: `actor_id`, `action`, `entity_type`,
  `entity_id`, `before`, `after`, `correlation_id`.
- Filtra secretos (`password`, `token`, `secret`, `mfa_secret`, ...) y va a dos destinos:
  1. Log JSON por línea (`sismo.audit`), inmediato; es el respaldo si la base falla.
  2. Tabla `audit_logs` (migración `0011`), de **solo inserción**: un trigger rechaza
     `UPDATE`, `DELETE` y `TRUNCATE`.
- Se llama **después** del `commit` (o antes de rechazar una petición), así que guarda con
  su propia sesión, en segundo plano. Un fallo al guardar nunca tumba la operación.
- Si no se pasa `correlation_id`, toma el de la petición en curso (`X-Correlation-ID`).
- Al apagar la API o al final de un script: `await esperar_auditoria()`.
- Consulta: `GET /api/v1/audit-logs` (permiso `auditoria`), paginado, con filtros
  `actor_id`, `action`, `entity_type`, `entity_id`, `from`, `to`.

## 6. Tiempo

- **BD en UTC**; la UI muestra **UTC-5**.
- Reloj único del backend: `app/core/clock.py` (`now()`, `real_now()`). No usar
  `datetime.now()` directo en servicios.
- El frontend no inventa "hoy": lo toma de `/api/v1/meta` (`data_min_day`,
  `data_max_day`, `last_sync_at`) y lo ancla vía `apps/web/src/lib/ancla.ts`.

## 7. Ingesta

- Idempotencia por `(source_id, external_id)` (`INSERT ... ON CONFLICT DO NOTHING`).
- La marca incremental es el fin de la última ejecución finalizada (`ingestion_runs`).
- Normalizador de referencia: `services/ingestion/normalizers/igp.py`.
- Evento normalizado (`services/ingestion/models.py`): incluye `source_url` opcional.
- Carga histórica: `python -m app.scripts.sincronizar --fuente usgs --desde AAAA-MM-DD`
  (se pide por tramos de un año; no duplica lo ya guardado).

## 7b. Datasets (Preparación de datos)

- `POST /api/v1/datasets` (permiso `preparacion`) crea una **nueva versión** por nombre y
  congela la lista de eventos en `dataset_events`. `POST /{id}/approve` solo Administrador.
- Un dataset **aprobado es inmutable** (trigger). Para cambiarlo, nueva versión.
- Quien entrene con un dataset debe leer sus eventos de `dataset_events` (no volver a
  consultar `seismic_events`) y aplicar `quality_report.imputacion` tal como está
  guardada. Partición: `dataset_events.split` (`entrenamiento` antes de `split_date`,
  `prueba` desde `split_date`).

## 7c. Modelos de ML

- `POST /api/v1/ml/experiments` (permiso `modelos`) entrena sobre un dataset **aprobado**
  y guarda el experimento en una sola inserción (la tabla no admite UPDATE). Un fallo
  también se guarda (`status = fallido`, `error`).
- Tareas: `conteo_semanal` (D2) y `regresion_lineal` (didáctica). Métricas en la partición
  de prueba del dataset; `algorithm` es el de menor MAE, aunque sea una referencia.
- `POST /api/v1/ml/models/{experiment_id}/approve` (solo Administrador) registra el modelo
  en `model_registry`; se rechaza si el mejor resultado es una referencia.
- El modelo entrenado se guarda en `services/ml/artifacts/<id>.joblib` (no se versiona).

## 8. Datos y estados

- Nada de datos de ejemplo ni valores inventados. Si falta un dato: `null` y la UI muestra
  `"—"` o `"Pendiente de backend"`.
- Categorías de dato (siempre distinguibles): **observado**, **pendiente de validación**,
  **estimación experimental**, **comunicado oficial**.
- Seismic events: `review_status ∈ {observado, pendiente_validacion}`; `source_url` es
  opcional (si el proveedor no la trae, se usa la URL base de la fuente o queda vacía).

## 9. Migraciones

- Alembic con **una sola cabeza**: `alembic heads`. Si hay dos, `alembic merge`.
- Ubicación: `services/api/migrations/versions/`.

## 10. Secretos

- Solo en variables de entorno; **nada** en el repo.
- La contraseña del admin se pide por consola o `SISMO_ADMIN_PASSWORD`; nunca por argumento.
