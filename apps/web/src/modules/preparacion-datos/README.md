# Módulo: Preparación de datos

Datasets versionados para análisis y ML (ruta `/preparacion-datos`, PDF §6.5).
Consume la API real `/api/v1/datasets` (ver `docs/CONTRATOS.md` §7b y la
decisión D16 en `docs/DECISIONES.md`).

## Estructura

```
modules/preparacion-datos/
├─ PreparacionDatosPage.tsx        # Página: aviso, formulario, filtro por estado, tabla y detalle
├─ types.ts                        # Tipos que reflejan la API (dataset, informe, filas)
├─ schemas/
│  └─ datasets.schema.ts           # Etiquetas, opciones, validación y formato de días UTC
├─ services/
│  └─ datasets.service.ts          # Llamadas a la API (listar, crear, detalle, filas, aprobar, fuentes)
└─ components/
   ├─ AvisoPreparacion.tsx         # Qué es un dataset, versión e inmutabilidad
   ├─ NuevoDataset.tsx             # Formulario: periodo, reglas, variables y fecha de corte
   ├─ TablaDatasets.tsx            # Lista paginada (clic → detalle)
   ├─ DetalleDatasetModal.tsx      # Pestañas: informe, vista previa, configuración; aprobar
   ├─ InformeCalidad.tsx           # Informe de calidad calculado por el backend
   ├─ VistaPrevia.tsx              # Eventos del dataset por partición, imputación marcada
   └─ InsigniaEstadoDataset.tsx    # Borrador / Aprobado (colores neutros)
```

## Reglas

- **Crear**: Analista o Administrador. **Aprobar**: solo Administrador (el botón se
  oculta a los demás; la API lo exige igual).
- Un dataset **aprobado** no se modifica: para cambiarlo se crea una versión nueva
  con el mismo nombre (el formulario conserva los valores tras crear).
- El informe de calidad lo calcula el backend; la pantalla solo lo muestra.
- Periodos y fechas de corte se muestran como **días UTC** (así se definen); las
  fechas de los eventos, en UTC-5 como el resto de la plataforma.
- Sin colores de peligro: las advertencias de calidad usan el color de acento.
