# DECISIONES — Sismora

Decisiones que **difieren del PDF** o que el PDF **no define**. Formato: qué se decidió,
por qué, y qué se descartó. La fuente de verdad funcional sigue siendo el PDF v1.0; aquí
solo se registran los puntos grises.

## D1. Fuente única (por validar)

- **Decisión:** el sistema parte de **una sola fuente** (IGP) y su nombre/organización/URL
  se configuran por entorno (`VITE_FUENTE_NOMBRE/ORG/URL`), con valor por defecto `"—"`.
- **Motivo:** el PDF no fija la fuente definitiva ni su contrato de datos. No se inventa un
  nombre ni una URL.
- **Descartado:** escribir "IGP" fijo en reportes/UI o dejar valores de ejemplo.
- **Estado:** *por validar*. Al confirmar proveedor, se rellenan las variables de entorno.

## D2. Autorización por rol en el backend

- **Decisión:** toda autorización se aplica en el backend con `require_role()` /
  `require_permission()` (`app/core/permissions.py`). El frontend **solo oculta** módulos.
- **Motivo:** regla del PDF; el PDF no detalla cómo, solo que el frontend no protege.
- **Descartado:** confiar en el ocultamiento del menú o en validaciones de cliente.

## D3. Mapa en blanco (sin GeoJSON)

- **Decisión:** el módulo Mapa sísmico **no dibuja geometría de regiones**: muestra un
  recuadro "Capa base pendiente" y, mientras no haya GeoJSON real, no se pinta ningún
  polígono inventado. Los eventos sí se ubican por coordenadas.
- **Motivo:** no hay fuente GeoJSON oficial cargada; dibujar fronteras aproximadas sería un
  dato inventado.
- **Descartado:** incluir un GeoJSON de ejemplo del Perú en el repo.
- **Nota:** el mapa decorativo (`PeruMap`) solo aparece en login/registro, sin datos.

## D4. Nombres de campos: `url_api`/`kind` frente a `base_url`/`source_type`

- **Decisión:** la tabla `data_sources` usa `url_api`, `kind`, `enabled`, y `last_sync_at`
  se **calcula** (no se almacena), en lugar de los nombres `base_url`/`source_type`/
  `status`/`last_sync_at` del PDF §7.
- **Motivo:** los nombres del PDF son de alto nivel; el modelo concreto quedó así en la
  base heredada del grupo y cubre los mismos conceptos. `last_sync_at` derivado evita
  desincronización respecto a `ingestion_runs`.
- **Impacto:** ninguno funcional; solo diferencia de nomenclatura.
- **Descartado:** renombrar columnas (rompería migraciones y modelos ya integrados).

## D5. Códigos de rol en inglés

- **Decisión:** los códigos de rol son `admin`, `analyst`, `alert_operator`, `auditor`,
  `viewer`; las etiquetas en pantalla van en español.
- **Motivo:** son identificadores estables usados en JWT, BD y permisos; cambiarlos a
  español obligaría a migrar datos y tokens. El PDF no fija el idioma del código.
- **Descartado:** usar el nombre en español como código.

## D6. Auditoría como log JSON mientras no exista `audit_logs`

- **Decisión:** `registrar_auditoria()` mantiene su firma y **emite log JSON estructurado**
  (`sismo.audit`) hasta que exista la tabla `audit_logs`.
- **Motivo:** `audit_logs` pertenece al módulo **Auditoría** (Dueño B); el núcleo ya emite
  los eventos con la firma acordada para no bloquearlo.
- **Descartado:** crear la tabla `audit_logs` desde el núcleo (invadiría lo de B).

## D7. `source_url` por evento

- **Decisión:** se añadió la columna `seismic_events.source_url` (migración
  `0009_event_source_url`), poblada en la ingesta. Si el proveedor no la entrega, la API
  usa la URL base de la fuente; si tampoco existe, queda `null`.
- **Motivo:** el PDF (§6.2/§7) pide la URL de procedencia **por evento**; derivarla solo de
  la fuente no era suficiente.
- **Descartado:** dejar solo `data_sources.url_api`.

## D8. Valores ausentes nunca inventados

- **Decisión:** cualquier dato faltante es `null`; la UI muestra `"—"` o
  "Pendiente de backend". Ej.: fuente sin proveedor → `SOURCE_FALLBACK = "—"`.
- **Motivo:** regla del PDF; evita presentar ceros o textos fijos como datos reales.
- **Descartado:** rellenar con `0`, `"IGP"`, `"sin datos"` u otro valor ficticio.

## D9. Profundidad media y mediana

- **Decisión:** el resumen estadístico del backend expone **media** además de
  p25/mediana/p75, y el Dashboard muestra "Profundidad media" y "Profundidad mediana".
- **Motivo:** el PDF §6.1 pide "profundidad media/mediana"; solo faltaba la media.
- **Descartado:** mostrar solo la mediana.

## D10. Contraseña del administrador

- **Decisión:** `crear_admin.py` obtiene la contraseña **solo** por consola interactiva o
  por la variable `SISMO_ADMIN_PASSWORD`. No existe `--password`.
- **Motivo:** pasar la contraseña por argumento la deja en el historial y en la lista de
  procesos; regla de "secretos solo en variables de entorno".
- **Descartado:** `--password`, y cualquier contraseña escrita en README/scripts/reportes.

## D11. Prefijos de ruta en inglés

- **Decisión:** las rutas usan inglés (`/events`, `/sources`, `/reports`, `/analytics`) bajo
  `/api/v1`, aunque el código y la UI estén en español.
- **Motivo:** sigue el borrador del PDF §8; el PDF no impone idioma pero usa inglés.
- **Descartado:** rutas en español (incompatibles con el §8).

## D12. Reutilizar la base del grupo

- **Decisión:** se conserva la base heredada (React 18, Tailwind 3, Vite 5, `.gitignore`,
  `.env.example`, docker-compose, README) y lo propio entra por capas.
- **Motivo:** aprovechar la interfaz ya hecha y no migrar versiones sin motivo.
- **Descartado:** reescribir el stack desde cero.

## D13. Contraseña por defecto de Postgres en desarrollo

- **Decisión:** `docker-compose.yml` y `config.py` usan el valor `sismo_dev` **solo** como
  valor por defecto de desarrollo; en producción se define por entorno
  (`POSTGRES_PASSWORD`).
- **Motivo:** permitir `docker compose up` sin `.env` para desarrollo local.
- **Descartado:** exigir `.env` para levantar el entorno local.
