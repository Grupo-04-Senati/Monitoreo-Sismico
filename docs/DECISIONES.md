# DECISIONES — Sismora

Decisiones que **difieren del PDF** o que el PDF **no define**. Formato: qué se decidió,
por qué, y qué se descartó. La fuente de verdad funcional sigue siendo el PDF v1.0; aquí
solo se registran los puntos grises.

## D1. Fuente única (por validar) — resuelta por D15

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

## D6. Auditoría como log JSON mientras no exista `audit_logs` (superada por D14)

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

## D14. Auditoría persistente sin cambiar la firma

- **Decisión:** `registrar_auditoria()` conserva su firma síncrona y sin sesión. Además del
  log JSON, programa la escritura en `audit_logs` con una sesión propia, en segundo plano;
  `esperar_auditoria()` la completa al apagar la API o al final de un script. La tabla es
  de solo inserción por trigger y `actor_id` no es clave foránea (el registro sobrevive a
  la cuenta).
- **Motivo:** las llamadas existentes ocurren después del `commit` o justo antes de
  rechazar una petición (login fallido, acción denegada), así que no comparten la
  transacción del cambio; cambiar la firma obligaba a tocar todos los módulos.
- **Costo:** si el proceso muere entre la respuesta y la escritura, el evento queda solo
  en el log JSON. El dueño de la tabla puede desactivar el trigger: en producción la API
  debe conectarse con un rol que no sea dueño de las tablas.
- **Descartado:** cambiar la firma para recibir la sesión (rompe a todos los llamadores) y
  un driver síncrono aparte (bloquearía el bucle de eventos en cada evento).

## D15. Fuente de eventos: USGS

- **Decisión:** la primera fuente real es el catálogo del **USGS** (servicio FDSN, GeoJSON),
  registrado por la migración `0012_fuente_usgs`. Se piden solo eventos de tipo
  `earthquake` dentro del recuadro de `ingestion/validation.py`. Primera sincronización:
  últimos 365 días; luego, desde la última ejecución con 6 h de solape.
  `reviewed` → "observado", `automatic` → "pendiente de validación".
- **Motivo:** API pública, sin clave, documentada y estable; deja trabajar con datos reales
  desde ya. El IGP queda como segunda fuente cuando se verifiquen sus condiciones de uso.
- **Limitaciones conocidas:**
  - `region` (departamento) queda vacía: el USGS no la entrega. Se podrá derivar cuando haya
    una capa geográfica oficial de departamentos (ver D3).
  - El recuadro incluye zonas fronterizas de países vecinos; `locality` lo indica (texto
    del USGS, en inglés).
  - La ingesta solo inserta: si el USGS revisa un evento después (magnitud, estado), el
    cambio no se aplica todavía. Queda como mejora.
  - Profundidades negativas (sobre el nivel del mar) se rechazan por la regla de
    profundidad; quedan en el registro de la ejecución.
- **Descartado:** esperar al IGP para tener datos (bloqueaba el resto del plan) y usar un
  conjunto de datos de ejemplo.

## D16. Datasets: instantánea de eventos, versión por nombre e informe de calidad

- **Decisión:** un dataset guarda la lista exacta de eventos (`dataset_events`), no solo la
  consulta. Se versiona por nombre; al aprobarse queda inmutable (trigger). Las reglas de
  limpieza son un conjunto fijo y explícito (duplicados exactos y posibles, solo
  revisados, tipos de magnitud, magnitud mínima, sin profundidad: excluir / imputar con la
  mediana / conservar), aplicadas en ese orden y contadas una por una en el informe. La
  partición es temporal (fecha de corte), nunca aleatoria. Crear: Analista o Administrador;
  aprobar: solo Administrador.
- **Motivo:** reproducibilidad (PDF §10: "conservar dataset y configuración exactos") aunque
  el catálogo crezca o se corrija, y evitar fuga de información futura en el ML.
- **Costo:** una fila por evento y dataset (miles, no millones). Los "posibles duplicados"
  (< 60 s y < 50 km) pueden ser réplicas reales: por eso solo se quitan si se pide.
- **Descartado:** guardar solo la consulta (no reproducible), partición aleatoria (fuga de
  datos en series temporales) e imputación silenciosa (se guarda método y valor).

## D17. Experimentos de ML: referencias, partición del dataset y aprobación

- **Decisión:** dos tareas. `conteo_semanal` (D2): sismos del dataset por semana (lunes
  UTC) estimados con rezagos de 1, 2 y 4 semanas y la media de las 12 anteriores;
  modelos lineal y de Poisson frente a dos referencias, la media del entrenamiento y la
  semana anterior. `regresion_lineal`: ejercicio didáctico del PDF §10 con las variables
  y el objetivo que declara el dataset. Siempre se usa la partición temporal del dataset
  (aprobado e inmutable) y se mide en prueba con MAE (principal), RMSE y R². Se guardan
  semilla, versiones de librerías, coeficientes, la serie real-vs-estimada y el artefacto.
  El experimento no se modifica (trigger). Se aprueba en `model_registry` solo si gana un
  modelo, nunca una referencia.
- **Motivo:** los conteos semanales están muy dispersos (réplicas: varianza ~17 con media
  ~2,5), así que un modelo solo aporta si supera a referencias simples, y eso hay que
  mostrarlo. Con los datos reales (2000–2026, M ≥ 4.5, corte 2022) Poisson mejora a la
  media solo un ~2 %: se advierte como mejora marginal, no como capacidad de pronóstico.
- **Costo:** se entrena dentro de la petición (segundos); si crece, pasa a Celery sin
  cambiar las tablas. No hay clasificación todavía.
- **Descartado:** partición aleatoria (fuga de información), aprobar una referencia como
  si fuera un modelo y prometer predicción de sismos.

## D18. Estimaciones: semana en curso, intervalo empírico y revisión

- **Decisión:** solo un modelo aprobado de conteo semanal estima. Se estima la semana en
  curso (lunes a lunes, UTC) con las 12 semanas completas anteriores del catálogo actual,
  contadas con las mismas reglas de limpieza del dataset del modelo. El intervalo del
  90 % sale de los errores reales del modelo en su partición de prueba (cuantiles 5–95 %),
  no de una fórmula de Poisson. Junto al valor se guarda la referencia (media histórica),
  las entradas y advertencias (semana sin terminar, datos desactualizados, intervalo
  demasiado ancho). Nace "en revisión"; solo un Administrador publica o retira. Los
  valores no se modifican ni se borran (trigger).
- **Motivo:** PDF §6.7 y §7 (modelo y versión, incertidumbre, fecha, advertencia, estado
  de revisión, no mezclar con eventos observados). Con réplicas, un intervalo teórico de
  Poisson sería engañosamente estrecho.
- **Costo:** sin zonas (la fuente no da el departamento): la unidad es la cobertura del
  dataset. Solo un paso adelante (no varias semanas), para no encadenar estimaciones.
- **Descartado:** estimar con la regresión lineal didáctica, publicar automáticamente y
  enviar estimaciones como alertas.

## D19. Reglas y centro de alertas: avisos internos con aprobación

- **Decisión:** una regla (magnitud mínima, rango de profundidad, tipos de magnitud, solo
  revisados y zona: toda la cobertura o un círculo con lat/lon/radio) se crea y edita
  **inactiva**; solo un Administrador la activa, y cualquiera con el permiso `reglas` la
  desactiva. Una regla activa no se edita (409): hay que desactivarla y volver a aprobarla.
  El motor corre tras cada sincronización que inserta eventos; si falla, la ingesta no se
  revierte (solo se registra el error). Un aviso por evento y regla (restricción única);
  cooldown medido por la hora del evento (lo que cae dentro queda `suprimida`) y
  antigüedad máxima (24 h por defecto) para no avisar de sismos viejos al reingestar.
  Por defecto requiere aprobación: `pendiente_aprobacion → aprobada → enviada | fallida`;
  también `cancelada` (con motivo) y acuse de recibo. Canales: `app` (siempre entregado)
  y `email` por SMTP, desactivado por defecto (`ALERT_EMAIL_ENABLED=false`): la entrega
  queda `simulada`, nunca se finge un envío. Las entregas fallidas se reintentan a mano.
  Simulación retrospectiva sobre los últimos N días antes de activar.
- **Motivo:** PDF §6.8 y §6.9. Es una plataforma empresarial privada: los avisos son
  internos (`categoria = "aviso_interno"`) y la plantilla dice que no es una alerta
  oficial (IGP/INDECI). La aprobación humana evita avisos falsos por datos preliminares.
- **Costo:** sin polígonos ni GeoJSON de regiones (solo círculo), sin SMS ni webhooks, sin
  escalamiento automático ni reintentos programados. Las estimaciones de ML nunca disparan
  avisos.
- **Descartado:** activar reglas sin aprobación, enviar correo real por defecto y avisar
  automáticamente sobre estimaciones.

