# HANDOFF — Entrega del núcleo (Dueño A)

Estado de la entrega del **núcleo** (Dashboard, Eventos, Mapa, Análisis, Fuentes, Reportes,
Usuarios y auth). Rama: `feat/nucleo-mis-modulos`. Etiqueta: `v0.1-nucleo`.
**No se ha hecho push ni merge.**

## 1. Qué está listo

- Backend FastAPI bajo `/api/v1` con los módulos del Dueño A y la ingesta del USGS integrada.
- Base de datos Postgres con migraciones Alembic (una sola cabeza) y **sin datos de ejemplo**.
- Frontend Vite/React conectado a la API real para los módulos de A.
- Contraseña de admin solo por consola/`SISMO_ADMIN_PASSWORD`; sin secretos en el repo.
- Pruebas de ingesta (idempotencia del motor) en verde.
- Todos los módulos del plan con API y pantalla; Fase 9 cerrada: CI (D21), despliegue con
  HTTPS y copias (D22, `docs/DESPLIEGUE.md`), monitoreo (D23), `docs/MANUAL_TECNICO.md` y
  `docs/CHECKLIST_ACEPTACION.md`.

**Demostración:** `docs/GUION_DEMO.md` (recorrido de todas las funciones) y
`python -m app.scripts.preparar_demo estado|cuentas|avisos`.

## 2. Cómo levantar todo

### Requisitos
- Docker Desktop (para Postgres + Redis).
- Python 3.11+ (probado con 3.13) y Node.js 20+.

### 2.1 Variables de entorno
```bash
# En la raíz, y en services/api y apps/web según corresponda:
cp .env.example .env        # editar valores; NUNCA subir .env
```
En desarrollo basta con los valores por defecto de `docker-compose.yml`.

### 2.2 Base de datos y Redis
```bash
docker compose -f infra/docker/docker-compose.yml up -d db redis
```

### 2.3 Backend (API)
```bash
cd services/api
python -m venv .venv
# Windows:  .venv\Scripts\activate      Linux/macOS:  source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head                     # aplica migraciones hasta la cabeza
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
La API queda en `http://127.0.0.1:8000` (docs en `/api/v1/docs` con `API_DEBUG=true`).

### 2.4 Primera cuenta (administrador)
```bash
# Con la API/BD arriba y el venv activo, desde services/api:
python -m app.scripts.crear_admin --email admin@tu-dominio.pe

# Primera carga de sismos reales (USGS, últimos 365 días). Sin Redis/Celery, repetirla
# a mano o con un cron:
python -m app.scripts.sincronizar
# La contraseña se pide por consola. En CI: SISMO_ADMIN_PASSWORD=... y el mismo comando.
```

### 2.5 Frontend
```bash
cd apps/web
npm install
npm run dev                              # http://localhost:5173
```

### 2.6 Todo con Docker (opcional, desarrollo)
```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

### 2.7 Producción
Ver **`docs/DESPLIEGUE.md`** (D22): `infra/prod/` con HTTPS automático, copias diarias
de PostgreSQL, restauración y simulacro.

## 3. Verificaciones (antes de cada PR)

El CI de GitHub (`.github/workflows/ci.yml`, D21) repite esto en cada PR sobre una base
vacía; conviene correrlo también en local, donde hay datos y corren todas las pruebas.

```bash
# Backend
cd services/api
python -m alembic heads                  # debe mostrar UNA sola cabeza
python -m compileall -q app ../ingestion
cd ../..

# API + ingesta
pytest tests -q                          # o: services/api/.venv/Scripts/python -m pytest tests -q

# Frontend
cd apps/web
npm run build
```

## 4. Qué queda pendiente

### 4.1 Módulos del Dueño B
- **Preparación de datos**: API y pantalla listas (`/api/v1/datasets`, D16).
- **Auditoría**: API y pantalla listas (filtros, detalle antes/después, exportación auditada; D14, D20).
- **Modelos ML**: API y pantalla listas (`/api/v1/ml`, D17).
- **Estimaciones**: API y pantalla listas (`/api/v1/estimates`, D18).
- **Reglas y Centro de alertas**: API y pantallas listas (`/api/v1/alert-rules`,
  `/api/v1/alerts`, D19). Correo SMTP desactivado por defecto (entregas `simulada`). El
  Dashboard muestra los avisos por atender (`active_alerts`).
- **Configuración**: API y pantalla listas (`/api/v1/settings`, D20). `INGESTION_SOURCE_KEY` ya no se usa:
  las fuentes activas salen de `data_sources`.
- No tocar sin avisar; el núcleo ya deja los puntos de integración (`registrar_auditoria`,
  `permissions.py`, `models.py`).

### 4.2 Pendientes del núcleo / dependencias externas
- **Auditoría**: retención configurable con purga manual protegida (D20). Pendiente: purga
  programada si la empresa la exige.
- **Regiones**: departamento derivado de las coordenadas y capa oficial en el mapa (D24).
  Tras actualizar una instalación con datos previos: `python -m app.scripts.asignar_regiones`.
  Pendiente: mapa propio en el Dashboard (hoy remite al Mapa sísmico).
- **Ingesta**: fuente USGS funcionando (D15) con correcciones de la fuente aplicadas e
  historial de revisiones (D27). Pendiente: el IGP como segunda fuente.
- **Vista mundial (D30) y SMS con consentimiento (D31)**: Mapa sísmico Perú/Mundo; canal SMS
  por Twilio (simulado sin credenciales), número en «Mi perfil». Ver DEMO_EN_LINEA.md.
- **Demo en línea**: `render.yaml` + `infra/render/Dockerfile` (API sirve la web, simulador
  de sismos ficticios, modelo reconstruible; D28, D29). Guía en `docs/DEMO_EN_LINEA.md`.

### 4.3 Pruebas faltantes (backlog)
- [x] **403 por rol**: matriz de los 5 roles en `tests/api/test_autorizacion.py`.
- [x] **Datos en CI**: muestra real del USGS (`tests/fixtures`); corren alertas y eventos.
- [x] **react-router 7**: hecho (`npm audit`: 0 vulnerabilidades).
- [x] **E2E y accesibilidad**: `apps/web/e2e` (18 flujos, axe WCAG 2.1 AA).
- [ ] **Idempotencia de sync (extremo a extremo)**: repetir la sincronización contra la BD
      real no duplica filas por `(source_id, external_id)` (hoy probado solo a nivel de motor).
- [ ] **410 en reportes**: descargar un reporte inexistente/eliminado devuelve `410 Gone`
      (y `404` para un id que nunca existió).

## 5. Reglas recordatorio

- Sin datos de ejemplo ni inventados. Falta un dato → `null` / `"—"`.
  Excepción marcada: el simulador de la demo en línea (D29, `docs/DEMO_EN_LINEA.md`).
- Estados distintos: observado / pendiente de validación / estimación experimental /
  comunicado oficial. Nunca una estimación de ML como alerta oficial.
- Autorización siempre en el backend (`require_role()`).
- Secretos solo en variables de entorno.
