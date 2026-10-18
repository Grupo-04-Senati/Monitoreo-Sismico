# Módulo: Análisis estadístico

Análisis **descriptivo** del catálogo de eventos (ruta `/analisis`, grupo
**Analítica**). Resume la historia y la distribución de los eventos ya
observados: serie temporal, histogramas, dispersión con correlación, conteo por
región, resumen estadístico y tabla de eventos. Consume el **catálogo real** de
la API (`GET /api/v1/events`, vía `cargarCatalogo()`); los 480 eventos de ejemplo
viven en la base de datos (semilla).

> Una correlación no implica causalidad ni capacidad de predecir sismos. Cada
> gráfica muestra su `n`, los datos faltantes y los filtros aplicados.

## Interacción (reglas de UX)

- **Barra superior por tarjeta**: cada gráfico/tabla concentra en su
  **barra superior** el título, la ayuda (ⓘ), la **tabla de datos** del gráfico
  (botón *Tabla*), **Ampliar**, **PNG** y **CSV**, en lugar de repartir acciones
  por el pie.
- **Gráficos que aprovechan el ancho**: el `viewBox` de los SVG se ajusta al
  ancho real del contenedor (`ResizeObserver`) manteniendo la escala uniforme
  (no se deforma el texto) y **alta acotada**: 200 px en la tarjeta y 300 px en
  la vista ampliada. Las barras horizontales usan filas de ~34 px y hacen
  *scroll* si hay muchas regiones.
- **Interacción sin modales apilados**: al tocar una **barra**, un **punto** de
  la dispersión o una **fila** de la tabla de eventos, el detalle de los eventos
  se abre en un **panel lateral dentro del mismo modal** (`ListaEventos`), no
  como una segunda ventana. El botón **Eventos (n)** lista toda la selección.
  En la cuadrícula de tarjetas, el clic abre el modal de eventos (`PanelEventos`).
- **Modal por cada elemento que lo merece**: pulsar una **barra** o un **punto**
  abre la lista de eventos que lo componen; pulsar un **indicador (KPI)** abre su
  ficha (qué significa y cómo se calcula); **Ampliar** abre la vista completa.
- **Paginación y "filas por página" ARRIBA**, junto a los filtros de la tabla
  (no al pie).
- **PNG de los gráficos**: cada gráfico se dibuja como **SVG nativo** y se
  exporta a PNG con `exportSvgPng` (resuelve los colores del tema a valores
  concretos, escala 2×). Las tablas exportan **CSV**.

## Estructura

```
modules/analisis/
├─ AnalisisPage.tsx                 # Página: encabezado, aviso, filtros, KPIs, tarjetas y pie
├─ types.ts                         # Tipos del módulo (filtros, resultados, definiciones)
├─ lib/
│  ├─ estadistica.ts                # Estadística pura (media, cuantiles, desviación, Pearson/Spearman)
│  └─ tablas.ts                     # Tablas derivadas de cada gráfico y de una lista de eventos
├─ schemas/
│  └─ analisis.schema.ts            # Filtros por defecto, opciones, variables, chips y definición de tarjetas
├─ services/
│  └─ analisis.service.ts           # calcular(filtros): filtra el catálogo y deriva todo el análisis
└─ components/
   ├─ AvisoAnalisis.tsx             # Aviso fijo: análisis descriptivo y affordance de clic
   ├─ FiltrosAnalisis.tsx           # Filtros "Datos" y "Análisis" (subconjunto por contexto)
   ├─ ChipsAnalisis.tsx             # Filtros activos como chips + "Limpiar filtros"
   ├─ TarjetasKpi.tsx               # 7 indicadores (clic = ficha)
   ├─ TarjetaGrafico.tsx            # Tarjeta con barra superior (info/Ampliar/PNG/CSV)
   ├─ Graficos.tsx                  # SVG: barras, barras horizontales, dispersión y selector por id
   ├─ TablaDatos.tsx                # Tabla reutilizable
   ├─ Controles.tsx                 # SelectorFilas (5/10/25) + Paginador (rango y ◀ ▶), arriba
   ├─ PanelGrafico.tsx              # Vista ampliada de un gráfico (filtros + gráfico + tabla)
   ├─ PanelEventos.tsx              # Lista de eventos de una barra/punto
   └─ ModalIndicador.tsx            # Ficha de un KPI
```

## Filtros

- **Datos**: periodo (`24h`/`7d`/`30d`/`Rango`), zona (región), magnitud (mín/máx),
  tipo de magnitud (Mw/ML/mb/sin tipo) y profundidad (mín/máx).
- **Análisis**: agrupación temporal (hora/día/semana/mes), resolución del
  histograma de magnitud (1.0/0.5), variable X e Y, método de correlación
  (Spearman/Pearson) y número de regiones (Top 8/15/25).

## Gráficos

| id | Tarjeta | Gráfico |
|----|---------|---------|
| `ts` | Serie temporal de eventos | Barras + media móvil de 7 días (agrupación día) |
| `mh` | Histograma de magnitud | Barras por rango (resolución configurable) |
| `sc` | Dispersión X vs Y | Puntos; ρ de Spearman o r de Pearson |
| `rg` | Conteo por región | Barras horizontales (Top N) |
| `dh` | Distribución de profundidad | Barras por rango de profundidad |
| `st` | Resumen estadístico | Tabla por variable (n, faltantes, tendencia central, dispersión) |
| `ev` | Tabla de eventos | Tabla de la selección (exportable) |

## Cálculo

`calcular(filtros, catalogo)` (`services/analisis.service.ts`) es una función
**pura**: filtra el catálogo (periodo, zona, magnitudes, tipo, profundidad) y
deriva serie, histogramas, conteo por región, dispersión + correlación, resumen,
tabla de eventos y KPIs. El catálogo llega como argumento (`SeismicEvent[]`,
proyectado del API con `desdeCatalogo`); la página lo carga con
`cargarCatalogo()`. Los cálculos estadísticos viven en `lib/estadistica.ts` y se
pueden verificar de forma aislada.

## Exportación

- **PNG** por gráfico (barra superior de la tarjeta y de la vista ampliada) a
  través de `exportSvgPng` de `@/lib/export`.
- **CSV** por tarjeta y por lista de eventos (`exportFilasCsv`).

Al conectar la API real, `calcular` debe consumir el catálogo del backend
(`GET /api/v1/events`) en lugar de `mockEvents`; el resto del módulo (gráficos,
filtros, exportación) no cambia.
