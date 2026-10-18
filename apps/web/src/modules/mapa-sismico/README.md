# Módulo: Mapa sísmico

Exploración espacial de eventos observados y regiones (ruta `/mapa-sismico`,
grupo **Monitoreo**). Hoy consume **datos de ejemplo (mock determinista)**, el
mismo catálogo que el módulo de Eventos.

> **Ubicación de eventos reportados. No representa zonas de impacto ni peligro.**

## Principios (alcance del MVP)

- **No hay proveedor de mapas ni dependencias geoespaciales.** El módulo dibuja
  su propio SVG a partir de un GeoJSON que **carga el usuario**.
- **Sin GeoJSON no se dibuja ningún contorno ni punto.** La vista muestra "Capa
  base pendiente" y el botón *Cargar GeoJSON de regiones*.
- Está **prohibido** generar contornos de regiones/provincias por cuenta propia:
  la geografía siempre viene del archivo del usuario.
- El archivo debe traer el nombre del departamento en una propiedad conocida
  (`NOMBDEP`, `DEPARTAMEN`, `DEPARTAMENTO`, `NOMBRE`, `NAME`, `name`, `region`);
  si un nombre no coincide con los 25 departamentos, **se avisa** y esa figura se
  omite.
- Una sola gama de color (cian neutro). **Ningún color indica peligro.**

## Estructura

```
modules/mapa-sismico/
├─ MapaPage.tsx                 # Página: aviso, filtros, mapa, panel de regiones y modales
├─ types.ts                     # Tipos del módulo
├─ lib/
│  └─ geo.ts                    # Interpretación de GeoJSON, proyección, distancia y agrupación
├─ schemas/
│  └─ filtros.schema.ts         # Opciones, validación, URL ⇄ filtros y chips
├─ services/
│  └─ mapa.service.ts           # Filtrado, resumen por región y exportación
├─ hooks/
│  ├─ useFiltrosMapaURL.ts      # Filtros en la URL
│  └─ useGeoJSON.ts             # Carga del archivo en el navegador
└─ components/
   ├─ AvisoMapa.tsx             # Aviso fijo (ubicación, no impacto/peligro)
   ├─ FiltrosMapa.tsx           # Barra de filtros (sticky)
   ├─ ChipsMapa.tsx             # Filtros activos como chips
   ├─ MapaBase.tsx              # Mapa SVG: regiones sombreadas + puntos
   ├─ LeyendaMapa.tsx           # Escala por cantidad, tamaños M3–M5, fuente y hora
   ├─ PanelRegiones.tsx         # Tabla de las 25 regiones (Σ coincide con n)
   ├─ ModalMapa.tsx             # Vista ampliada con filtros propios y tablas
   └─ ModalExportarMapa.tsx     # Exportación por partes (regiones / eventos)
```

## Filtros (URL como fuente de la verdad)

| Parámetro       | Valores                                          |
| --------------- | ------------------------------------------------ |
| `region`        | slug de la región (área geográfica)              |
| `periodo`       | `24h` · `7d` · `30d` · `custom`                  |
| `desde`/`hasta` | `YYYY-MM-DD` (solo con `periodo=custom`)         |
| `magMin`/`magMax` | número                                        |
| `capa`          | `ambos` · `regiones` · `eventos`                 |
| `estado`        | `observado` · `pendiente_validacion`             |
| `rlat`/`rlon`   | centro del radio de búsqueda (grados)            |
| `radioKm`       | radio en km (requiere `rlat`+`rlon`)             |

Los chips permiten quitar cada filtro y "Limpiar todo" restablece los valores por
defecto. La validación (fechas, magnitud y radio) vive en
`schemas/filtros.schema.ts`.

## El mapa (`MapaBase`)

1. **Sin GeoJSON**: solo el recuadro "Capa base pendiente" y el botón de carga.
2. **Con GeoJSON** el usuario ve:
   - las regiones dibujadas y **sombreadas por cantidad de eventos** (escala
     neutra de cian; gris claro = sin eventos);
   - los **puntos de eventos** con tamaño por magnitud, **agrupados** cuando están
     muy cerca en pantalla (el grupo muestra el conteo);
   - la **leyenda** con la escala de color, los tamaños M3/M4/M5 y la fuente/hora;
   - el **círculo de radio** (de búsqueda) cuando se define un centro.

Interacción:

- **Clic en una región** (o en su fila del panel) → aplica el filtro de región.
- **Clic en un punto** → abre el detalle del evento (mismo modal del módulo de
  Eventos). Un grupo abre la vista ampliada.
- **Clic en el fondo del mapa** → abre la **vista ampliada** (`ModalMapa`) con
  filtros propios, tabla de eventos/regiones y exportación por partes.

## Panel de regiones

Tabla con las **25 regiones** (eventos, % del total y magnitud máxima); el pie
compara `Σ regiones` con el total `n` (deben coincidir). El clic filtra.

## Criterios de aceptación

- Sin GeoJSON **no se dibuja ningún contorno ni punto**.
- Con GeoJSON, la **suma de la tabla de regiones coincide con n**.
- **Ningún color indica peligro.**

## Cambiar el mock por la API real

`services/mapa.service.ts` deriva de `EVENTOS_SISMICOS`. Para conectar el
backend, `eventosFiltrados` debe consumir `GET /api/v1/events/geojson` (devuelve
una `FeatureCollection` con `id`, `magnitude`, `magnitude_type`, `depth_km`,
`region`, `occurred_at`, `source`, más `source` y `generated_at`) y acepta los
mismos filtros que el catálogo, además de `lat`, `lon`, `radius_km` y `bbox`
(`min_lon,min_lat,max_lon,max_lat`). El polígono libre queda para una fase
posterior.
