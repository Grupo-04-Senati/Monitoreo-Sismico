# Módulo: Fuentes de datos

Estado y operación del conector con el proveedor de eventos sísmicos (ruta
`/fuentes-datos`, grupo **Datos**). Muestra un aviso de fuente única, KPIs de la
ingesta, la ficha del conector y cuatro pestañas: **Ejecuciones** (gráfico de
latencia + tabla), **Calidad** (nulos por campo), **Registro** (logs) y
**Configuración**. Cada bloque tiene una **vista ampliada** (pantalla completa) y
los datos se pueden **exportar por partes en CSV o Excel (.xlsx)**. Hoy consume
**datos de ejemplo (mock determinista)**.

## Estructura

```
modules/fuentes-datos/
├─ FuentesDatosPage.tsx            # Página: encabezado, aviso, KPIs, ficha, pestañas y pie
├─ types.ts                        # Tipos del módulo (reexporta los de @/types)
├─ kpis.ts                         # Definición de los 6 indicadores y secciones ampliables
├─ schemas/
│  └─ fuentes.schema.ts            # Pestañas, opciones, etiquetas/colores y URL ⇄ estado
├─ services/
│  └─ fuentes.service.ts           # Acceso a datos (mock), sincronización, resumen por hora y exportación
├─ hooks/
│  ├─ useFuentesURL.ts             # Pestaña/filtros/paginación en la URL
│  ├─ useFuentesMeta.ts            # Ficha, resumen, calidad y configuración
│  ├─ useEjecuciones.ts            # Página de ejecuciones
│  ├─ useEjecucionesVentana.ts     # Todas las ejecuciones de la ventana (gráfico)
│  └─ useLogs.ts                   # Página del registro
└─ components/
   ├─ AvisoFuente.tsx              # Aviso fijo: fuente única, secretos, idempotencia
   ├─ TarjetasFuente.tsx           # 6 KPIs del conector (clic = vista ampliada)
   ├─ FichaConector.tsx            # Ficha técnica (incluye referencia de credencial)
   ├─ PestanasFuente.tsx           # Navegación por pestañas (pulsar la activa = ampliar)
   ├─ GraficoLatencia.tsx          # Latencia por ejecución (marca fallidas, puntos clicables)
   ├─ TablaEjecuciones.tsx         # Filtros + tabla + paginación + detalle
   ├─ DetalleEjecucion.tsx         # Contenido del detalle de una ejecución (reutilizable)
   ├─ DetalleEjecucionModal.tsx    # Detalle técnico de una ejecución (modal independiente)
   ├─ TablaCalidad.tsx             # % de nulos por campo
   ├─ TablaLogs.tsx                # Registro con filtro por nivel
   ├─ FormularioConfiguracion.tsx  # Configuración del conector
   ├─ SeccionModal.tsx             # Vista ampliada de KPI/ficha/gráfico/tabla (+ exportar)
   ├─ ModalExportar.tsx            # Exportación por partes en CSV o Excel
   ├─ ModalSincronizar.tsx         # Confirmación de sincronización manual
   ├─ SelectorFilas.tsx            # Selector de filas por página (5/10/25) en la barra de filtros
   └─ Paginador.tsx                # Barra de paginación (rango y Anterior/Siguiente), arriba
```

## Vistas ampliadas y exportación

- **Pantalla completa**: al pulsar una tarjeta de KPI, la ficha del conector, el
  gráfico o el botón *Pantalla completa* de cada tabla —y al volver a pulsar la
  pestaña activa— se abre una vista ampliada. La de los KPIs explica qué mide y
  cómo se calcula, con gráfico y detalle por hora. Pulsar un punto del gráfico o
  una fila abre el detalle de esa ejecución **como panel lateral dentro del propio
  modal** (a la derecha, sin abrir un segundo modal), con navegación
  *Anterior/Siguiente*.
- **Filtros propios**: cada vista ampliada trae su propia barra de filtros
  (periodo, estado, nivel, orden y búsqueda) **independiente** de la página; se
  puede restablecer y la exportación respeta lo que se está viendo. Las
  ejecuciones se consultan con las funciones sincrónicas `ventanaEjecuciones` y
  `registroCompleto` del servicio.
- **Paginación**: las tablas ampliadas (ejecuciones, registro y calidad) paginan
  por su cuenta. El selector **filas por página (5/10/25)** y la navegación
  *Anterior/Siguiente* (con el rango y el indicador de página) van **arriba**,
  junto a los filtros, igual que en las tablas de la página.
- **Exportación por partes**: el botón *Exportar* (o *Exportar esta parte*/*todo*
  en la vista ampliada) abre un diálogo para elegir los bloques y el formato.
  **CSV** entrega un archivo con los bloques seleccionados; **Excel (.xlsx)**
  entrega una hoja por parte (generado sin dependencias, ver `src/lib/xlsx.ts`).
  Partes: Resumen, Conector, Ejecuciones, Resumen por hora, Calidad, Registro y
  Configuración.

## Aviso, KPIs y ficha

- **Aviso fijo**: fuente única en el MVP; URL/límites/contacto pendientes de
  validar; las credenciales solo se referencian (nunca en texto plano) y la
  ingesta es idempotente.
- **KPIs**: estado del conector (con punto de color), último éxito, latencia
  media, tasa de éxito, registros insertados y duplicados omitidos. Cada tarjeta
  incluye una **mini-serie (sparkline)** con la tendencia horaria de su métrica.
- **Gráfico por indicador**: cada KPI se representa con el tipo de gráfico que
  mejor lo describe (`kpis.ts`, campo `grafico`): **barras horizontales** para la
  distribución por estado; **área** para series temporales (ejecuciones y latencia
  por hora); **barras** para conteos, con **línea objetivo** en la tasa de éxito y
  **línea comparativa** (insertados) en los duplicados.
- **Ficha del conector**: nombre, organización, tipo, URL/API, frecuencia,
  última ejecución, último éxito, latencia, límites, licencia, contacto y la
  referencia de credencial (`secret://sismo/fuente-api`, **valor oculto**).
- El color de estado (verde/ámbar/rojo) se usa **solo** para la salud operativa
  del conector, nunca para eventos sísmicos.

## Pestañas

| Pestaña          | Contenido                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| `ejecuciones`    | Gráfico de latencia, filtros (periodo/estado/orden), tabla y detalle      |
| `calidad`        | Tabla de % de nulos por campo (barra 0–10 %) con valor de ejemplo         |
| `registro`       | Logs (INFO/WARN/ERROR) con filtro por nivel/orden y correlacionador       |
| `configuracion`  | Parámetros del conector (editable **solo Administrador**)                 |

Estados de ejecución: `correcta`, `con_errores`, `fallida` y `en_curso`.

El **orden** permite alternar *Últimos primero* (más recientes) y *Primeros
primero* (más antiguos) en las tablas de ejecuciones y de registro.

## Contrato de estado (URL como fuente de la verdad)

La pestaña, los filtros y la paginación viven en la URL, por lo que cada vista es
compartible.

| Parámetro | Valores                                                   |
| --------- | --------------------------------------------------------- |
| `tab`     | `ejecuciones` · `calidad` · `registro` · `configuracion`  |
| `estado`  | `correcta` · `con_errores` · `fallida` · `en_curso`       |
| `periodo` | `1h` · `3h` · `12h`                                        |
| `nivel`   | `INFO` · `WARN` · `ERROR`                                  |
| `orden`   | `recientes` · `antiguos`                                   |
| `pag`     | entero ≥ 1                                                |
| `tam`     | `5` · `10` · `25`                                        |

Ejemplo: `/fuentes-datos?tab=registro&nivel=ERROR&orden=antiguos&tam=25`

## Roles y permisos

| Acción                          | Permiso               | Roles                          |
| ------------------------------- | --------------------- | ------------------------------ |
| Ver el módulo y exportar        | `fuentes`             | Administrador, Analista, Auditor |
| Sincronizar ahora (manual)      | `fuentes_sincronizar` | Administrador                  |
| Editar la configuración         | `fuentes_configurar`  | Administrador                  |

El bloqueo por rol es de interfaz; **la API real debe validarlo también**. La
sincronización manual es idempotente y queda registrada en Auditoría.

## Datos reales de la API

Toda la lectura pasa por `services/fuentes.service.ts`, que llama a la API real.
Contratos:

```
GET   /api/v1/sources                 → lista de fuentes
GET   /api/v1/sources/{id}            → ficha + resumen
GET   /api/v1/sources/{id}/quality    → calidad por campo
GET   /api/v1/sources/{id}/runs       → ejecuciones (filtros + página)
GET   /api/v1/sources/{id}/logs       → registro
PATCH /api/v1/sources/{id}            → guardar configuración
POST  /api/v1/sources/{id}/sync       → sincronización manual
```

La respuesta paginada debe tener la forma `{ filas, total, pagina, tamano,
totalPaginas }` (ver `PaginaEjecuciones` / `PaginaLogs` en `types.ts`).

## Fuente y zona horaria

- Hay **una sola fuente** de datos, declarada en `src/config/fuente.ts`
  (`SOURCE_NAME`). Al migrar a la API, el proveedor debe venir del backend y las
  credenciales gestionarse como secretos (nunca en texto plano).
- Las horas se muestran en **UTC-5** (Perú); el detalle de ejecución incluye
  además la marca UTC completa.
