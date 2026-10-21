# Módulo: Modelos ML

Laboratorio de experimentos de ML (ruta `/modelos-ml`, PDF §6.6). Consume la API
real `/api/v1/ml` (ver `docs/CONTRATOS.md` §7c y la decisión D17).

## Estructura

```
modules/modelos-ml/
├─ ModelosMLPage.tsx                 # Página: aviso, formulario, registro de experimentos y de modelos
├─ types.ts                          # Tipos que reflejan la API (experimento, métricas, modelo)
├─ schemas/
│  └─ ml.schema.ts                   # Tareas, etiquetas de modelos/variables, formatos y validación
├─ services/
│  └─ ml.service.ts                  # Llamadas a la API (+ datasets aprobados para el formulario)
└─ components/
   ├─ AvisoModelos.tsx               # Qué es y qué no es un experimento (no es alerta oficial)
   ├─ NuevoExperimento.tsx           # Formulario: nombre, tarea, dataset aprobado y semilla
   ├─ TablaExperimentos.tsx          # Registro de experimentos (clic → detalle)
   ├─ TablaModelos.tsx               # Modelos aprobados (los únicos que publicarán estimaciones)
   ├─ DetalleExperimentoModal.tsx    # Comparación, real vs. estimado, coeficientes, ficha; aprobar
   ├─ GraficoRealEstimado.tsx        # Curva real frente a estimada en prueba (eje desde 0)
   └─ InsigniaEstadoExperimento.tsx  # Completado / Fallido / Modelo aprobado (colores neutros)
```

## Reglas

- **Entrenar**: Analista o Administrador, solo con datasets **aprobados**.
- **Aprobar**: solo Administrador, y nunca si el menor MAE es de una referencia (no hay
  modelo que aprobar). El botón se oculta a los demás; la API lo exige igual.
- La comparación con las referencias y las advertencias del backend se muestran tal
  cual: si un modelo no aporta, la pantalla lo dice.
- La gráfica empieza el eje en 0 (PDF §11: sin ejes truncados que exageren diferencias).
