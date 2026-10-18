# HANDOFF — Entrega del núcleo (Dueño A)

Estado de la entrega del **núcleo** (Dashboard, Eventos, Mapa, Análisis, Fuentes, Reportes,
Usuarios y auth). Rama: `feat/nucleo-mis-modulos`. Etiqueta: `v0.1-nucleo`.
**No se ha hecho push ni merge.**

## 1. Qué está listo

- Backend FastAPI bajo `/api/v1` con los módulos del Dueño A y la ingesta (IGP) integrada.
- Base de datos Postgres con migraciones Alembic (una sola cabeza) y **sin datos de ejemplo**.
- Frontend Vite/React conectado a la API real para los módulos de A.
- Contraseña de admin solo por consola/`SISMO_ADMIN_PASSWORD`; sin secretos en el repo.
- Pruebas de ingesta (idempotencia del motor) en verde.

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
# La contraseña se pide por consola. En CI: SISMO_ADMIN_PASSWORD=... y el mismo comando.
```

### 2.5 Frontend
```bash
cd apps/web
npm install
npm run dev                              # http://localhost:5173
```

### 2.6 Todo con Docker (opcional)
```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

## 3. Verificaciones (antes de cada PR)

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

### 4.1 Módulos del Dueño B (hoy `ModuleStub` / routers vacíos)
- Preparación de datos, Modelos ML, Estimaciones, Reglas de alertas, Centro de alertas,
  Auditoría, Configuración.
- No tocar sin avisar; el núcleo ya deja los puntos de integración (`registrar_auditoria`,
  `permissions.py`, `models.py`).

### 4.2 Pendientes del núcleo / dependencias externas
- **`audit_logs`**: la auditoría se emite como log JSON; falta la tabla (módulo Auditoría).
- **GeoJSON de regiones**: el mapa dibuja "Capa base pendiente" hasta tener geometría real.
- **Conector real de ingesta**: hoy `PendienteConnector` (no llama a ninguna API externa);
  el normalizador IGP está listo para el formato del proveedor.
- **Fuente única**: por validar proveedor y URL reales (hoy `"—"`).

### 4.3 Pruebas faltantes (backlog)
- [ ] **403 por rol**: cada endpoint protegido devuelve `403 "No tiene permisos..."` cuando
      el rol no corresponde (probar los 5 roles de `core/permissions.py`).
- [ ] **Idempotencia de sync (extremo a extremo)**: repetir la sincronización contra la BD
      real no duplica filas por `(source_id, external_id)` (hoy probado solo a nivel de motor).
- [ ] **410 en reportes**: descargar un reporte inexistente/eliminado devuelve `410 Gone`
      (y `404` para un id que nunca existió).

## 5. Reglas recordatorio

- Sin datos de ejemplo ni inventados. Falta un dato → `null` / `"—"`.
- Estados distintos: observado / pendiente de validación / estimación experimental /
  comunicado oficial. Nunca una estimación de ML como alerta oficial.
- Autorización siempre en el backend (`require_role()`).
- Secretos solo en variables de entorno.
