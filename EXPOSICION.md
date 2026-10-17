# Guía para exponer Sismora

> **Estado: esqueleto.** Se completa al culminar todo el desarrollo (Fase 8), cuando haya pantallas, cifras y despliegue reales. Hasta entonces solo se anotan aquí las preguntas y las ideas que vayan surgiendo.
> Reglas: no inventar cifras, usar solo las medidas y los conteos de pruebas del cierre de la Fase 8, y marcar con *(por verificar)* lo que no se haya comprobado en el despliegue real.

> Proyecto grupal de 4 personas: en la exposición, cada integrante presenta el módulo del que es dueño (ver `docs/EQUIPO.md`) y el equipo explica en conjunto cómo se coordinó (AGENTS.md, PR con revisión cruzada, CI).

Objetivo: mostrar **qué hace** y **cómo funciona por dentro**, con datos sísmicos **reales** (USGS) y alertas de prueba. Duración sugerida: 12–15 min.

## Caso de negocio (decirlo al empezar)

*(Por redactar al cierre. Borrador:)* Una organización con activos en zonas sísmicas del Perú necesita saber, sin revisar webs a mano, qué sismos ocurren cerca de sus instalaciones, avisar al equipo correcto con trazabilidad y analizar la actividad histórica. El sistema centraliza los eventos con su procedencia, dispara avisos **internos** por reglas con aprobación y acuse, y ofrece un laboratorio de ML que **no promete predecir terremotos**.

| Lo que pasa en el negocio | Qué lo resuelve en el sistema |
|---|---|
| Hay que enterarse de los sismos relevantes | Ingesta automática y deduplicada desde USGS, con fuente y hora de consulta |
| Hay que avisar a la persona correcta | Reglas por magnitud, zona y profundidad; aprobación; acuse y escalamiento |
| No se quieren falsas alarmas | Simulación retrospectiva de la regla antes de activarla |
| No se puede confundir un dato con un aviso oficial | Cuatro categorías siempre visibles: observado, pendiente, estimación experimental, comunicado oficial |
| Hay que confiar en los datos | Informe de calidad, datasets versionados y monitor de frescura de la fuente |
| Hay que rendir cuentas | Auditoría de solo inserción y reportes con fecha de corte y solicitante |

### Los cinco roles y su papel real

*(Por completar al cierre, contrastando con la matriz de permisos real.)*

| Rol | Quién es | Qué hace | Lo que NO puede hacer, y por qué |
|---|---|---|---|
| Administrador | | | |
| Analista | | | |
| Operador de alertas | | | |
| Auditor | | | |
| Solo lectura | | | |

**La idea detrás de la separación:** *(por completar: quien analiza no activa alertas, quien activa no edita la auditoría, etc.)*

Frase para abrir: *(por redactar al cierre)*

Idea de fondo: **los eventos observados generan los datos; el análisis, las alertas y el ML los consumen** sin mezclarse con ellos.

## Guion (borrador de estructura)

1. **Problema y límite honesto (1 min).** Qué resuelve y qué NO: no predice sismos; la alerta temprana oficial detecta un sismo ya iniciado.
2. **Arquitectura (2 min).** Diagrama web → API → servicios → repositorios → PostgreSQL; proceso de ingesta aparte; laboratorio ML aparte. Una capa, una responsabilidad.
3. **Seguridad (2 min).** Roles, cookie HttpOnly, 403 en el backend, auditoría que la base no deja editar.
4. **Ingesta real (3 min).** Mostrar Fuentes y `ingestion_runs`; repetir la sincronización y demostrar que **no duplica**.
5. **Dashboard, mapa y análisis (3 min).** Filtros que coinciden con la API; cada gráfica con fuente, muestra y hora de corte.
6. **Flujo de una alerta — la parte central (4 min).** Simular la regla → activarla → llega un evento → alerta pendiente → aprobación → entrega → acuse; reintentar sin duplicar; ver todo en auditoría.
7. **Laboratorio ML (3 min).** Target, partición temporal, baseline, métricas y ficha del modelo. Mostrar la etiqueta «experimental» y que una estimación **no puede** enviarse como alerta oficial.
8. **Despliegue y operación (2 min).** URL pública, CI, backup y restauración probados, arranque en frío del plan gratuito *(despertar el servidor antes)*.
9. **Lo que viene (1 min).** Segunda fuente (IGP), más canales, PostGIS, MFA.

## Preguntas probables

Preparadas desde ya (las respuestas se afinan con lo construido):

- *¿El sistema predice terremotos?* No. Monitorea eventos ya ocurridos, estima estadísticas de actividad con incertidumbre y avisa por reglas. La ciencia actual no permite predecir fecha, lugar y magnitud; el diseño separa a propósito observado, estimación y comunicado oficial.
- *¿Qué es entonces una «alerta temprana»?* Un aviso tras detectar un sismo que ya comenzó, desde una infraestructura autorizada; da segundos, no anticipa. Este sistema no la emite.
- *¿Las alertas son oficiales?* No. Son avisos operativos internos de la organización; no sustituyen a IGP ni INDECI.
- *¿Por qué USGS y no el IGP?* USGS ofrece un feed público sin clave, útil para tener datos reales desde el inicio; el IGP queda como segunda fuente tras verificar acceso y condiciones de uso (D1).
- *¿Por qué ese target de ML?* Conteo semanal de sismos M≥4.5 por zona es medible, respeta el orden temporal y no sugiere predecir un sismo concreto (D2). Clasificar la magnitud de eventos ya conocidos casi no demuestra nada.
- *¿Y si el modelo no supera al baseline?* Se reporta tal cual: es un resultado científico válido y evita vender una capacidad que no existe.
- *¿Qué es la fuga de datos y cómo se evitó?* Usar información que no existiría al momento de estimar; se evita con partición temporal y features calculadas solo con el pasado.
- *¿Por qué las alertas antes que el ML?* Dan valor empresarial inmediato; el ML es lo más incierto (D3).
- *¿Por qué Celery y Redis?* Dan programación periódica y reintentos ya resueltos para la ingesta y las alertas (D5). El costo es operar más piezas; el estado de ingestas y alertas también vive en PostgreSQL, para poder prescindir de ellos si el hosting gratuito no los admite.
- *¿Cómo evitan alertas duplicadas?* Deduplicación por evento + regla + canal y envíos idempotentes con reintentos *(detalle por completar)*.
- *¿Cómo sabes que cada rol hace solo lo suyo?* Matriz rol × endpoint probada automáticamente *(detalle por completar)*.
- *¿Qué pasa si la fuente deja de responder?* Monitor de frescura y alerta operativa distinta de las sísmicas *(detalle por completar)*.

*(Añadir aquí las que surjan en cada fase, con su decisión de referencia.)*

## Antes de exponer

*(Por completar al cierre. Incluirá: recrear la base limpia —la auditoría es de solo inserción, así que se recrea la base entera—, correr migraciones y seeds, ingesta inicial USGS, `pytest` y `npm test`, un usuario por rol, revisar modo oscuro y tamaño de proyector, despertar el servidor 2–3 minutos antes y tener un respaldo local por si falla la red.)*
