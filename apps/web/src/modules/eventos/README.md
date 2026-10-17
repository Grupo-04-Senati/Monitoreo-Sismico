# Módulo: Eventos sísmicos

Catálogo operativo de eventos sísmicos (ruta `/eventos`, grupo **Monitoreo**).
Muestra un aviso de observación, la procedencia de los datos, tarjetas de
resumen, una tabla filtrable/ordenable/paginada con columnas opcionales, el
detalle de cada evento, un glosario y exportación a CSV. Hoy consume **datos de
ejemplo (mock determinista)**.

## Estructura

```
modules/eventos/
├─ EventosPage.tsx              # Página: aviso, procedencia, resumen, filtros, tabla, pie y detalle
├─ types.ts                     # Tipos del módulo (reexporta los de @/types)
├─ schemas/
│  └─ filtros.schema.ts         # Opciones, validación, URL ⇄ filtros y columnas opcionales
├─ services/
│  └─ eventos.service.ts        # Acceso a datos (mock), resumen, procedencia y CSV
├─ hooks/
│  ├─ useFiltrosURL.ts          # Filtros/orden/paginación/columnas en la URL
│  └─ useEventos.ts             # Carga de la página y del resumen de la selección
└─ components/
   ├─ AvisoObservacion.tsx      # Aviso fijo: eventos observados, no alertas oficiales
   ├─ FranjaProcedencia.tsx     # Fuente, sincronización, licencia/términos y rango
   ├─ TarjetasResumen.tsx       # 5 tarjetas que se recalculan con los filtros
   ├─ FiltrosEventos.tsx        # Barra de filtros
   ├─ ChipsFiltros.tsx          # Filtros activos como chips removibles
   ├─ SelectorColumnas.tsx      # Muestra u oculta columnas opcionales
   ├─ TablaEventos.tsx          # Tabla con orden, paginación y accesibilidad
   ├─ TablaSkeleton.tsx         # Esqueleto de carga
   ├─ EstadoVacio.tsx           # Estados vacío / error
   ├─ Glosario.tsx              # Glosario plegable y alcance de la pantalla
   ├─ DetalleEventoModal.tsx    # Ficha del evento (reutiliza ExpandModal)
   └─ MapaEvento.tsx            # Recuadro "Capa base pendiente"
```

## Aviso, procedencia y resumen

- **Aviso fijo** bajo el encabezado: los registros son *eventos observados*, no
  alertas oficiales ni predicciones (el proveedor puede corregirlos).
- **Franja de procedencia**: fuente única, última sincronización, licencia y
  términos de uso (hoy `pendiente`/`pendientes`) y rango del catálogo.
- **Tarjetas de resumen** (se recalculan con los filtros): eventos, magnitud
  máxima (con tipo y localidad), profundidad mediana con rango, pendientes de
  validación y sin tipo de magnitud (cantidad y % de la selección). Salen de
  `resumirEventos`; en la API real deben viajar en la misma respuesta
  (`resumen`) para no duplicar consultas.
- **Glosario plegable** con los términos y el alcance de la pantalla.

## Contrato de filtros (URL como fuente de la verdad)

Los filtros, el orden y la paginación viven en la URL, por lo que el estado es
compartible y los enlaces del Dashboard llegan con los filtros aplicados.

| Parámetro      | Valores                                         | Alias aceptados |
| -------------- | ----------------------------------------------- | --------------- |
| `periodo`      | `24h` · `7d` · `30d` · `custom`                 | —               |
| `desde`/`hasta`| `YYYY-MM-DD` (solo con `periodo=custom`)        | —               |
| `region`       | slug de la región (p. ej. `lima`)               | `zona`          |
| `magnitudMin`  | número                                          | `magmin`        |
| `magnitudMax`  | número                                          | `magmax`        |
| `estado`       | `observado` · `pendiente_validacion`            | —               |
| `orden`        | `fecha` · `localidad` · `region` · `magnitud` · `profundidad` · `estado` · `id` · `latitud` · `longitud` | — |
| `dir`          | `asc` · `desc`                                  | —               |
| `pagina`       | entero ≥ 1                                      | —               |
| `tamano`       | `10` · `25` · `50`                              | —               |
| `cols`         | `id` · `latitud` · `longitud` (lista separada por comas) | —        |

Ejemplo: `/eventos?periodo=7d&region=lima&magnitudMin=3&estado=observado&cols=id,latitud`

Las columnas opcionales (`id`, `latitud`, `longitud`) se muestran intercaladas
en su sitio natural y también se pueden usar como columna de orden.

La validación (mín. ≤ máx. en fechas y magnitud) se calcula en
`schemas/filtros.schema.ts` y el error se muestra junto al campo.

## Cambiar el mock por la API real

Toda la lectura de datos pasa por `services/eventos.service.ts`, que hoy
devuelve el catálogo de `src/lib/mock/events.ts` (`getEvents`). Para conectar el
backend, reemplaza el cuerpo de `listarEventos`:

```ts
export async function listarEventos(filtros, orden, pagina) {
  const qs = new URLSearchParams({
    periodo: filtros.periodo,
    ...(filtros.desde && { desde: filtros.desde }),
    ...(filtros.hasta && { hasta: filtros.hasta }),
    ...(filtros.region && { region: filtros.region }),
    ...(filtros.magnitudMin != null && { magnitudMin: String(filtros.magnitudMin) }),
    ...(filtros.magnitudMax != null && { magnitudMax: String(filtros.magnitudMax) }),
    ...(filtros.estado && { estado: filtros.estado }),
    orden: orden.campo,
    dir: orden.direccion,
    pagina: String(pagina.numero),
    tamano: String(pagina.tamano),
  });
  const res = await fetch(`/api/v1/events?${qs}`);
  if (!res.ok) throw new Error("No se pudieron cargar los eventos.");
  return (await res.json()) as PaginaEventos;
}
```

La respuesta debe tener la forma `{ filas, total, pagina, tamano, totalPaginas }`
(ver `PaginaEventos` en `types.ts`). El estado de error del módulo ya muestra un
botón **Reintentar**.

> La exportación CSV (`exportarEventosCsv`) descarga todos los eventos que
> cumplen los filtros, con el mismo orden que la tabla. Está habilitada para
> Administrador, Analista, Operador de alertas y Auditor (`eventos_exportar`);
> el bloqueo en la interfaz es solo informativo, **la API debe validarlo también**.

## Conectar la capa base del mapa

`components/MapaEvento.tsx` reserva el recuadro del mapa y muestra las
coordenadas en texto, sin dibujar geografía. Para conectarlo, sustituye el
contenido del `<div>` por el visor que corresponda (por ejemplo Leaflet o
MapLibre) usando las props `latitude`/`longitude`, y pasa `baseLayer` para
ocultar el aviso "Capa base pendiente".

## Fuente y zona horaria

- Hay **una sola fuente** de datos, declarada en `src/config/fuente.ts`
  (`SOURCE_NAME`). Por eso no existe filtro ni columna de proveedor; al migrar a
  la API, el proveedor debe venir del backend.
- La tabla muestra la hora en **UTC-5** (Perú); el detalle muestra UTC-5 y UTC.
