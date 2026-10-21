# CLAUDE.md — Contexto para el agente de IA que continúa el proyecto

> **Lee esto primero.** Este archivo explica **qué ya está hecho**, **qué está vacío a
> propósito** y **qué cosas parecen errores pero no lo son**. Sigue después con
> `AGENTS.md` (reparto y reglas), `docs/CONTRATOS.md`, `docs/DECISIONES.md` y
> `docs/HANDOFF.md`.
>
> **Estado del repo:** rama `feat/nucleo-mis-modulos`, etiqueta `v0.1-nucleo`.
> Todavía **no** está en `main` (sin push/merge). La `main` remota solo tiene el andamiaje base.

## 1. Qué es el proyecto

**Sismora** — plataforma de monitoreo sísmico (Perú): catálogo de eventos, dashboard,
mapa, análisis estadístico, fuentes/ingesta, reportes, usuarios y roles, y (a futuro) un
laboratorio de ML honesto. **Fuente de verdad funcional:** PDF *"Plan de desarrollo,
Sistema de monitoreo sísmico ML" v1.0* (en `docs/referencia/plan-base-v1.0.pdf`).

**Stack:** `apps/web` (Vite + React 18 + TS + Tailwind) · `services/api` (FastAPI `/api/v1`) ·
`services/ingestion` (paquete Python) · PostgreSQL + Redis (Docker) · Alembic.

## 2. Reparto de módulos (IMPORTANTE)

Hay **dos dueños**. No invadas la parte del otro.

| Dueño | Módulos | Estado |
|---|---|---|
| **A** (hecho) | Dashboard, Eventos, Mapa, Análisis, Fuentes, Reportes, Usuarios y roles, auth | **Implementado y conectado a la API real** |
| **B (tú)** | Preparación de datos, Modelos ML, Estimaciones, Reglas de alertas, Centro de alertas, Auditoría, Configuración | **Vacíos a propósito**: `ModuleStub` en el frontend y routers vacíos en el backend |

En el frontend, los módulos de B están como **`ModuleStub`** (placeholder). Eso es
**intencional**, no un error ni "falta de código".

## 3. Qué está HECHO (avance del Dueño A)

- **Backend** bajo `/api/v1`: `auth`, `events` (+`/geojson`,`/{id}`), `dashboard/summary`,
  `analytics/timeseries`+`/summary`, `sources` (+runs/quality/logs/sync/config),
  `reports` (+types/detail/download), `users` (+summary/approve/suspend/reactivate/activity).
- **Ingesta** (`services/ingestion`): motor con reintentos/backoff, validación y
  normalizador IGP; persistencia **idempotente** por `(source_id, external_id)`.
- **Base de datos**: migraciones Alembic `0001`→`0009` con **una sola cabeza**
  (`alembic heads` = `0009_event_source_url`).
- **Frontend**: los 7 módulos de A + auth, contra la API real, con estados vacíos correctos.
- **Pruebas**: `pytest tests -q` → 3 passed (idempotencia del motor de ingesta).
- **Verificaciones**: `npm run build`, `compileall` y `alembic heads` en verde.

## 4. Cosas que PARECEN error pero son INTENCIONALES

No las "arregles" sin hablar con el equipo:

1. **No hay datos de ejemplo y la BD arranca vacía.** Si falta un dato → `null`, y la UI
   muestra `"—"` o `"Pendiente de backend"`. **Nunca** rellenar con ceros, textos fijos ni
   datos inventados.
2. **El mapa muestra "Capa base pendiente".** No hay GeoJSON real cargado; dibujar
   fronteras aproximadas sería dato inventado (ver `docs/DECISIONES.md` D3).
3. **La auditoría va a dos destinos.** `registrar_auditoria(...)` mantiene su **firma
   estable**, emite el log JSON (`sismo.audit`) y guarda en `audit_logs`, tabla de **solo
   inserción** (un trigger rechaza UPDATE/DELETE/TRUNCATE). Ver D6 y D14.
4. **`PendienteConnector` no llama a ninguna API externa.** El conector real y la fuente
   única están "por validar" (D1). El normalizador IGP ya está listo para el formato.
5. **`source_url` puede ser `null`.** Es la URL de procedencia por evento; si el proveedor
   no la trae, se usa la URL base de la fuente y si no, queda vacía.
6. **Códigos de rol en inglés** (`admin`, `analyst`, `alert_operator`, `auditor`, `viewer`),
   etiquetas en pantalla en español (D5).
7. **`data_sources` usa `url_api`/`kind`** (no `base_url`/`source_type` del PDF §7). Es solo
   diferencia de nombres, no funcional (D4).
8. **Sin rojo/ámbar/verde** en la UI que sugiera peligro; chips neutros.
9. **La etiqueta "estimación experimental" nunca es una alerta oficial.** Estados distintos:
   observado / pendiente de validación / estimación experimental / comunicado oficial.

## 5. Reglas de trabajo (resumen; detalle en `AGENTS.md`)

- Sin datos de ejemplo ni valores inventados (UI, API o seeds).
- **Autorización siempre en el backend** con `require_role()` / `require_permission()`
  (`services/api/app/core/permissions.py`); el frontend solo oculta.
- **Secretos solo en variables de entorno.** Nada de contraseñas en el repo. La cuenta
  admin se crea con `python -m app.scripts.crear_admin --email ...` (pide la contraseña por
  consola o la toma de `SISMO_ADMIN_PASSWORD`; **no** hay `--password`).
- **Hora en UTC en la BD, UTC-5 en la UI**; reloj único en `app/core/clock.py`.
- **Migraciones: una sola cabeza.** Si aparecen dos, `alembic merge`.
- Antes de un PR: `pytest`, `npm run build`, `alembic heads`.
- Cambios en lo del Dueño A: **abrir issue, no reescribir.**
- Compartidos (PR pequeño + aviso): `Sidebar.tsx`, router web (`App.tsx`),
  `core/permissions.py`, `main.py`, `db/models.py`, `package.json`, `requirements.txt`,
  `docker-compose`.
- Commits convencionales (`feat`/`fix`/`chore`/`docs`); rama por funcionalidad.

## 6. Contratos que NO debes romper

- Respuestas paginadas: `{ items, total, page, page_size }`. Errores con `{ "detail": ... }`
  y sin datos sensibles.
- `registrar_auditoria(actor_id, action, entity_type, entity_id, before, after, correlation_id)`
  — mantener la **firma**.
- Roles y permisos: fuente de verdad en `services/api/app/core/permissions.py`.
- Detalle completo en `docs/CONTRATOS.md`.

## 7. Cómo ejecutar y verificar

Ver **`docs/HANDOFF.md`** (levanta Docker, migra, crea admin, corre API y web;
incluye los comandos de verificación y la lista de **pruebas pendientes**:
403 por rol, idempotencia de sync extremo a extremo, y 410 de reportes).

## 8. Qué te toca a ti (Dueño B)

1. Rellenar los módulos en blanco: Preparación de datos, Modelos ML, Estimaciones, Reglas de
   alertas, Centro de alertas, Auditoría y Configuración.
2. ~~Crear la tabla `audit_logs`~~ (hecho, migración `0011`). Falta la pantalla de
   Auditoría, la retención configurable y la exportación auditada.
3. Nunca presentar una estimación de ML como alerta oficial.
4. Si necesitas tocar algo compartido o del Dueño A: abre un issue / avisa, no lo reescribas.
