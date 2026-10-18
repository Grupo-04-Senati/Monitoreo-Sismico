# Módulo "Reportes" (6.11)

Centro de informes de la plataforma. Permite **solicitar** un informe, seguir su
estado y **descargarlo** mientras el enlace siga vigente.

## Tipos de informe

| Tipo | Estado | Datos |
| --- | --- | --- |
| `eventos` | Disponible | Catálogo de eventos observados (mismo origen que el módulo de Eventos). |
| `calidad_datos` | Disponible | Métricas de la ingesta por ejecución (leídos, insertados, duplicados, latencia). |
| `fuentes_ingesta` | Disponible | Ficha del conector y parámetros de ingesta (**sin credenciales**). |
| `modelos` | **Disponible próximamente** | Depende del módulo de Modelos ML (interfaz `ReportProvider` en el backend). |
| `alertas` | **Disponible próximamente** | Depende del centro de alertas. |

Los dos últimos se sirven mediante la interfaz `ReportProvider`: cuando el
proveedor no está disponible, la interfaz lo muestra como "Disponible
próximamente" y el `POST` responde `409`.

## Reglas de negocio

- **Estados:** `pendiente`, `en_proceso`, `listo`, `fallido`, `expirado`.
- Cada informe guarda su **fecha de corte** y sus **filtros**: con los mismos
  parámetros se obtienen las mismas filas (**reproducibilidad**).
- El archivo vive en un directorio temporal y su enlace **expira** (24 h). Un
  enlace expirado devuelve `410` y **no** descarga nada.
- El archivo solo lo puede abrir el **solicitante** o un **Administrador**.
- Formatos **CSV / XLSX / PDF**; el PDF exige el permiso `reportes_pdf`.
- Ningún informe incluye credenciales ni secretos.
- Cada generación y cada descarga llaman a `registrar_auditoria()`.

## Roles

- **Solicitan:** Administrador, Analista, Operador de alertas y Auditor
  (`reportes_generar`).
- **Solo consultan:** rol de Solo lectura (`reportes`).

## Estructura

```
modules/reportes/
  ReportesPage.tsx              Composición de la vista
  types.ts                      Tipos del módulo (re-exporta @/types)
  kpis.ts                       Indicadores clicables
  schemas/reportes.schema.ts    Catálogo, etiquetas, URL ⇄ estado, validación
  services/reportes.service.ts  Acceso a datos (mock) + descarga
  hooks/useReportesURL.ts       Filtros/página en la URL
  components/
    AvisoReportes.tsx           Aviso fijo de reglas
    IndicadoresReportes.tsx     KPIs clicables
    GraficoReportes.tsx         Informes por tipo y estado (segmentos clicables)
    NuevoReporte.tsx            Formulario + vista previa
    FiltrosReportes.tsx         Filtros del catálogo
    TablaReportes.tsx           Tabla paginada
    DetalleReporteModal.tsx     Detalle, historial y vista previa de filas
    ModalListaReportes.tsx      Lista de un indicador o segmento
    InsigniaEstado.tsx          Insignia de estado
    Paginador.tsx / SelectorFilas.tsx
```

## API real (TODO)

```
GET  /api/v1/reports/types
GET  /api/v1/reports?tipo&estado&solicitante&pagina&tamano
POST /api/v1/reports
GET  /api/v1/reports/{id}
GET  /api/v1/reports/{id}/download   → 410 si el enlace expiró
```

La descarga usa `Blob` (`downloadFile`) con **respaldo**: si el navegador no
puede descargar, el contenido se copia al portapapeles (`copyText`). El PDF se
construye con `src/lib/pdf.ts` (escritor mínimo, sin dependencias).
