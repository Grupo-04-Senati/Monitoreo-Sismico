# AGENTS.md — Sismora

Plataforma de monitoreo sísmico (Perú). **Fuente de verdad:** PDF *"Plan de desarrollo,
Sistema de monitoreo sísmico ML"* v1.0.

## Stack

- **Frontend:** `apps/web` (Vite + React 18 + TS + Tailwind).
- **Backend:** `services/api` (FastAPI, prefijo `/api/v1`).
- **Ingesta:** `services/ingestion`.
- **BD:** PostgreSQL (Docker) + Redis.
- **Migraciones:** Alembic.
- **Cómo ejecutar:** ver `README` y `docs/HANDOFF.md`.

## Reparto

- **Dueño A (no tocar sin avisar):** Dashboard, Eventos, Mapa, Análisis, Fuentes,
  Reportes, Usuarios y roles, auth.
- **Dueño B (tú):** Preparación de datos, Modelos ML, Estimaciones, Reglas de alertas,
  Centro de alertas, Auditoría, Configuración. Hoy son `ModuleStub` / routers vacíos.
- **Compartidos (PR pequeño y aviso):** `Sidebar.tsx`, router web,
  `services/api/app/core/permissions.py`, `main.py`, `db/models.py`, `package.json`,
  `requirements.txt`, `docker-compose`.

## Reglas

- Sin datos de ejemplo ni valores inventados en UI, API o seeds por defecto. Si falta un
  dato: `null` y la UI muestra `"—"` o `"Pendiente de backend"`.
- Nunca presentar una estimación de ML como alerta oficial. Estados distintos:
  Observado / Pendiente de validación / Estimación experimental / Comunicado oficial.
- Autorización en el backend con `require_role()`; el frontend solo oculta.
- Roles (códigos): `admin`, `analyst`, `alert_operator`, `auditor`, `viewer`. Nombres en
  pantalla en español. Permisos en `core/permissions.py`.
- Secretos solo en variables de entorno. Nada en el repo.
- Hora en UTC en BD, UTC-5 en la UI. Fuente única (por validar).
- Colores: sin rojo/ámbar/verde que sugiera peligro.

## Contratos

- `registrar_auditoria(actor_id, action, entity_type, entity_id, before, after, correlation_id)`:
  mantener la firma; hoy escribe log JSON; B la persistirá en `audit_logs`.
- Respuestas paginadas: `items, total, page, page_size`. Errores sin datos sensibles.
- Migraciones: una sola cabeza (`alembic heads`). Si hay dos, `alembic merge`.

## Flujo de trabajo

Rama por funcionalidad desde `main`, PR pequeño, commits convencionales
(`feat`/`fix`/`chore`/`docs`). Antes de abrir el PR: `pytest`, `npm run build`,
`alembic heads`. Cambios en lo de A: abrir issue, no reescribir. Decisiones en
`docs/DECISIONES.md`.

Contratos detallados en `docs/CONTRATOS.md`. Decisiones y desvíos del PDF en
`docs/DECISIONES.md`. Estado de entrega y pendientes en `docs/HANDOFF.md`.
