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

## D20. Configuración: parámetros reales, control de cambios y retención con piso en la base

- **Decisión:** solo son editables (por el Administrador) los parámetros que algún módulo
  usa de verdad: vigencia de los reportes (`reportes_ttl_horas`, 24 h), umbral de datos
  desactualizados de las estimaciones (`estimaciones_horas_datos_recientes`, 48 h) y
  retención de la auditoría (`auditoria_retencion_dias`, 730 días). Se guardan en
  `system_settings`; sin fila rige el valor por defecto. Cada cambio queda en la auditoría
  con antes/después y se muestra como historial (control de cambios). Lo que vive en
  `.env` (secretos, CORS, cookies, SMTP) se muestra en solo lectura, sin secretos, con
  advertencias (p. ej. clave de sesión de desarrollo). La retención se aplica con una
  **purga manual** del Administrador, con vista previa y auditada; el trigger de
  `audit_logs` solo permite ese DELETE dentro de la purga y nunca para registros de menos
  de 365 días (UPDATE y TRUNCATE siguen prohibidos). La exportación CSV de la auditoría
  (Administrador y Auditor) también queda auditada, con filtros y número de filas.
- **Motivo:** PDF §6.13 (historial protegido, retención configurable, exportación
  auditada, control de cambios, parámetros del sistema) y §12 (política de retención).
- **Costo:** la IP no se registra (minimización de datos; el PDF la deja "según
  política"). Sin purga programada: se ejecuta a mano. Los límites de acceso (intentos de
  login) quedan fijos en el código y se muestran, no se editan desde la web.
- **Descartado:** editar secretos o variables de entorno desde la web, parámetros sin
  efecto real y borrar auditoría sin piso mínimo.

## D21. CI en GitHub Actions y arranque seguro en producción

- **Decisión:** cada push a `main` y cada pull request corren tres trabajos: backend
  (PostgreSQL 16 vacío, migraciones subir/bajar/subir, cuenta de administrador desechable
  con contraseña aleatoria por ejecución y toda la suite de pytest), frontend (`npm ci` con
  el package-lock, tipos y build) y seguridad (ningún `.env` versionado; `pip-audit` y
  `npm audit` informativos). Con `ENV=production` la API **no arranca** si quedan valores
  de desarrollo: clave de sesión por defecto o corta, cookies sin `Secure`, contraseña de
  base por defecto, CORS `*` o con localhost, o `DB_ECHO` activo. Todas las respuestas
  llevan cabeceras de seguridad (nosniff, sin iframes, Referrer-Policy,
  Permissions-Policy) y HSTS en producción.
- **Motivo:** PDF §12 y Fase 9 (pruebas automáticas, revisión de seguridad, secretos fuera
  del repositorio, HTTPS obligatorio).
- **Costo:** en CI no hay sismos (la base empieza vacía): las pruebas que los necesitan se
  omiten solas y siguen corriendo en local. La auditoría de dependencias no bloquea:
  señalaba `react-router` 6 (moderada); se resolvió pasando a `react-router` 7.
  El CI solo bloquea fusiones si se activa la protección de la rama `main` en GitHub.
- **Descartado:** descargar datos del USGS dentro del CI (lento e inestable) y bloquear
  por avisos de dependencias sin revisarlos.

## D22. Despliegue con Docker Compose, Caddy (HTTPS) y copias diarias verificadas

- **Decisión:** producción en un servidor propio con `infra/prod/docker-compose.yml`:
  PostgreSQL 16, Redis, API (imagen sin `--reload`, usuario sin privilegios, migra al
  arrancar), worker y beat de Celery (ingesta programada), Caddy (HTTPS automático con
  Let's Encrypt, frontend compilado y proxy de `/api` en el mismo dominio, cabeceras de
  seguridad y CSP) y un contenedor de copias (`pg_dump` diario, verificado con
  `pg_restore --list`, retención configurable). `restaurar.sh` nunca escribe sobre una
  base existente y `simulacro_restauracion.sh` restaura en una base temporal y compara
  migración y tablas. El CI construye las imágenes, levanta todo en modo producción con
  HTTPS en localhost, hace una prueba de humo y un simulacro de restauración.
- **Motivo:** PDF §12 y Fase 9 (HTTPS obligatorio, secretos fuera del repositorio,
  backups automatizados con simulacros de restauración, despliegue documentado).
- **Costo:** un solo servidor (sin alta disponibilidad). Un proceso de API por defecto
  porque el límite de intentos de acceso vive en memoria. Las copias quedan en el mismo
  servidor hasta que la empresa las saque a otro almacenamiento. Los volúmenes de modelos
  y reportes no entran en la copia de la base.
- **Descartado:** Kubernetes o servicios administrados (desproporcionados para el MVP) y
  nginx con certbot (Caddy renueva certificados sin tareas extra).

## D23. Monitoreo operativo propio, con umbrales a la vista

- **Decisión:** `GET /api/v1/monitoring` (solo Administrador; pantalla Configuración →
  Estado del sistema) comprueba base de datos, retraso de la ingesta por fuente frente a
  su frecuencia, ejecuciones fallidas o colgadas, avisos con entrega fallida o
  aprobación atrasada, latencia p50/p95 y errores 5xx de la API (medidos en el proceso)
  y antigüedad de la última copia de seguridad (carpeta montada en solo lectura). Cada
  comprobación da `ok`, `aviso`, `critico` o `sin_datos` con un detalle en lenguaje llano;
  los umbrales son constantes en `services/monitoreo.py`. `GET /health/ready` (público,
  sin datos) devuelve 503 si la base no responde, para monitores externos.
- **Motivo:** PDF §12 (monitorear fuentes, retraso de ingesta, fallos de tareas, latencia
  y entregas de alertas) y Fase 9 (monitorización y manuales).
- **Costo:** sin historial ni notificaciones propias: se consulta en vivo y conviene un
  monitor externo sobre `/health/ready`. La latencia se pierde al reiniciar la API y, con
  varios procesos, cada uno mide la suya.
- **Descartado:** Prometheus y Grafana (otra pieza que operar para un MVP de un servidor)
  y umbrales editables desde la web (se cambian revisando el código).

## D24. Región (departamento) derivada de las coordenadas

- **Decisión:** el USGS no entrega el departamento; se deriva al normalizar cada sismo con
  los límites departamentales (`services/ingestion/datos/peru_departamental_simple.geojson`,
  basado en el INEI, licencia MPL-2.0; el mismo archivo del fondo de la interfaz). Regla:
  dentro de un departamento → ese departamento; fuera de los polígonos (casi siempre en el
  mar) y con el texto de lugar de la fuente mencionando "Peru" → el departamento más
  cercano a menos de 200 km; en otro caso (otro país, sin texto o más lejos) → sin región.
  `python -m app.scripts.asignar_regiones` completa lo ya guardado (idempotente). La API
  sirve la capa (`GET /api/v1/regions/geojson`) y el Mapa sísmico la carga sola.
- **Motivo:** PDF §6.3 y §14 (filtros por zona coherentes en mapa, gráficas y API). Casi
  la mitad del catálogo cae fuera de los polígonos: 2 400 sismos frente a la costa
  peruana y 1 230 en países vecinos. Usar solo la distancia asignaba a "Puno" un sismo en
  La Paz; el texto de lugar de la fuente lo evita.
- **Costo:** el departamento de un sismo en el mar es "el más cercano", no una división
  oficial del mar. Con 200 km queda sin región un 0,5 % de los sismos peruanos (muy mar
  adentro). La geometría es simplificada: en un borde puede tocar el departamento vecino.
- **Descartado:** dejar `region` vacía (filtros inútiles), PostGIS (otra dependencia para
  25 polígonos) y asignar por distancia sin mirar el país.

## D25. Límite de intentos de acceso compartido en Redis

- **Decisión:** los contadores del límite de acceso (5 fallos → cuenta bloqueada 15 min;
  20 intentos por minuto por IP) se guardan en Redis, que producción ya tiene para Celery,
  así son compartidos entre todos los procesos de la API. `LOGIN_THROTTLE_BACKEND`: `auto`
  (Redis si responde, si no memoria; por defecto), `redis` (producción) o `memoria`. Si
  Redis falla en marcha, se cuenta en memoria por proceso (el límite nunca se desactiva),
  se reintenta Redis cada minuto y el Estado del sistema lo avisa. Los correos se guardan
  como huella SHA-256. Con esto producción usa `API_WORKERS=2` por defecto.
- **Motivo:** la prueba de carga (docs/CARGA.md) mostró que un proceso se satura cerca de
  100–150 usuarios; con el contador en memoria, 4 procesos permitían 4 veces más intentos
  de adivinar contraseñas (D22).
- **Costo:** en Redis el bloqueo cuenta desde el primer fallo (ventana fija de 15 min), no
  una ventana deslizante por intento como en memoria. Sin Redis, el límite vuelve a ser
  por proceso hasta que Redis responda.
- **Descartado:** guardar los contadores en PostgreSQL (más escrituras en cada login) y
  rechazar todos los accesos si Redis cae (dejaría a la empresa sin entrar).

## D26. Caché corta del catálogo compacto en el servidor

- **Decisión:** `GET /events/compact` guarda la respuesta ya serializada 30 s por
  combinación de filtros (máximo 16, en memoria de cada proceso). La clave incluye la hora
  de la última ejecución de ingesta terminada: en cuanto el worker termina una
  sincronización, la caché deja de servir lo anterior aunque corra en otro proceso.
- **Motivo:** la prueba de carga mostró que es la respuesta más pesada y la más repetida.
  Con la caché, un proceso pasa de 55 a 89 peticiones por segundo y el p95 del escenario
  agresivo de 1,8 s a 0,5 s (docs/CARGA.md).
- **Costo:** `generated_at` puede tener hasta 30 s; los datos no, porque cambian solo con
  una sincronización. Cada proceso tiene su caché (hasta 16 respuestas, ~40 MB en el peor
  caso con el catálogo completo). Una consulta mínima extra por petición (última ejecución).
- **Descartado:** caché en Redis (serializar y transferir 2 MB cuesta casi lo mismo que
  recalcular) e invalidar por tiempo largo sin mirar las sincronizaciones.

## D27. Correcciones de la fuente con historial y datasets a su fecha

- **Decisión:** el USGS corrige eventos días o semanas después (magnitud, ubicación,
  profundidad, paso de "automático" a "revisado"). En las sincronizaciones normales (la
  anterior fue hace menos de 60 días) se le piden los eventos de los últimos 60 días
  **modificados** desde la última sincronización (`updatedafter`). Si un evento guardado
  llega con fecha de modificación (`properties.updated`) más nueva y valores distintos, se
  actualiza y la versión anterior y la nueva quedan en `seismic_event_revisions` (solo
  inserción, trigger). Una versión más vieja se ignora. Los datasets aprobados y los
  modelos leen los valores tal como eran al crear el dataset. Un evento corregido se
  vuelve a evaluar contra las reglas de aviso (sin duplicar avisos).
- **Motivo:** PDF §6.2 (el proveedor puede revisar o corregir eventos) y §7. Antes, las
  correcciones se perdían (solo se insertaba lo nuevo, con 6 h de solape). Verificado con el
  servicio real: el 2026-10-21 había 5 eventos de la zona corregidos más de 2 días después
  de ocurrir (uno de Huacho, del 25-09, corregido el 15-10).
- **Costo:** una corrección de un evento de hace más de 60 días no se recoge (habría que
  pedir más historial en cada sincronización). Si la sincronización se detuvo más de 60
  días, la siguiente vuelve al modo por fecha de ocurrencia. Fuentes de datos muestra los
  corregidos por ejecución (tabla, detalle, resumen por hora, exportación y resultado de la
  sincronización manual) y su total en la tarjeta de registros.
- **Descartado:** sobrescribir sin historial (rompe datasets y modelos congelados, D16 y
  D17) y copiar todos los valores en cada dataset (duplica el catálogo).


## D28. El modelo aprobado se reconstruye si falta su archivo

- **Decisión:** si al generar una estimación no está el archivo `.joblib` del modelo, la
  API lo vuelve a entrenar con el dataset congelado y la semilla guardados en el
  experimento, lo deja en la carpeta de artefactos (marcado `reconstruido`) y sigue.
- **Motivo:** en servidores con disco efímero (Render gratuito, contenedores sin volumen)
  el archivo se pierde al reiniciar. El dataset aprobado no cambia (D16, D27) y el
  entrenamiento es determinista, así que el resultado es idéntico (lo comprueba
  `test_sin_el_archivo_del_modelo_se_reconstruye_igual`).
- **Costo:** la primera estimación tras un reinicio tarda unos segundos más.
- **Descartado:** guardar el modelo en la base (archivos binarios grandes en PostgreSQL) y
  exigir un volumen persistente (no existe en el plan gratuito).

## D29. Demostración en línea: simulador de sismos y un solo servicio

- **Decisión:** para mostrar la plataforma públicamente un día (docs/DEMO_EN_LINEA.md):
  1. **Simulador** (`DEMO_SIMULACION=true`, apagado por defecto): el Administrador crea
     sismos **ficticios** en Configuración. Pasan por el mismo camino que uno real
     (ejecución de ingesta, departamento, reglas activas, avisos y auditoría). Es la única
     excepción a "sin datos inventados" y está marcada: fuente "Simulador de demostración
     (datos ficticios)", deshabilitada para sincronizar; lugar con prefijo `[SIMULADO]`;
     advertencia en el estado de la configuración. Con el simulador apagado la ruta
     responde 404.
  2. **Un solo servicio**: con `WEB_DIST_DIR` la API sirve también la web compilada (misma
     CSP que Caddy). Web y API comparten dominio, así las cookies de sesión funcionan sin
     CORS ni reescrituras. `infra/render/Dockerfile` y `render.yaml` lo arman.
     El Blueprint no crea base (el plan gratuito admite una por cuenta): pide los datos
     de conexión de una base `sismo_db` aparte en una instancia existente.
  3. `POSTGRES_SSL=true` para conectar desde un PC a una base que exige SSL (cargar los
     datos iniciales en Render, que en el plan gratuito no da consola).
- **Motivo:** en una demostración no tiembla a pedido; los avisos solo se ven si llega un
  sismo. El plan gratuito de Render no tiene Redis, worker ni consola.
- **Costo:** sin worker ni beat no hay sincronización automática (la manual sí funciona) y
  el estado de la ingesta pasa a *Atención* tras unas horas. El servidor gratuito se
  duerme a los 15 min sin uso (~1 min en despertar) y la base gratuita vence a los 30 días.
- **Descartado:** cargar sismos de ejemplo fijos (se confundirían con los reales) y separar
  web estática y API (cookies entre dominios).
