# Módulo: Estimaciones experimentales

Resultados de modelos aprobados (ruta `/estimaciones`, PDF §6.7). Consume la API real
`/api/v1/estimates` (ver `docs/CONTRATOS.md` §7d y la decisión D18).

## Estructura

```
modules/estimaciones/
├─ EstimacionesPage.tsx                # Página: aviso, generar, filtro por estado, tabla y detalle
├─ types.ts                            # Tipos que reflejan la API (estimación, entradas)
├─ schemas/
│  └─ estimaciones.schema.ts           # Estados, color "experimental", ventana UTC y formatos
├─ services/
│  └─ estimaciones.service.ts          # Llamadas a la API (+ modelos aprobados de conteo semanal)
└─ components/
   ├─ AvisoEstimaciones.tsx            # No es predicción ni alerta; usa el disclaimer de la API
   ├─ NuevaEstimacion.tsx              # Elegir modelo aprobado y generar (semana en curso)
   ├─ TablaEstimaciones.tsx            # Lista con intervalo compacto (clic → detalle)
   ├─ DetalleEstimacionModal.tsx       # Valor, intervalo, advertencias, entradas, ficha; publicar/retirar
   ├─ BarraIntervalo.tsx               # Estimación + intervalo + media histórica (escala desde 0)
   ├─ GraficoEntradas.tsx              # 12 semanas observadas (gris) + estimación (violeta)
   └─ InsigniaEstimacion.tsx           # "Estimación experimental" + estado de revisión
```

## Reglas

- **Generar**: Analista o Administrador, solo con modelos aprobados de conteo semanal.
- **Publicar / retirar**: solo Administrador. Publicar no la convierte en alerta.
- Lo estimado usa siempre el violeta y la etiqueta "Estimación experimental", distinto de
  lo observado (gris) y de cualquier alerta (PDF §13: estados distinguibles).
- Toda vista muestra el intervalo, el modelo y su versión, la fecha y la media histórica.
