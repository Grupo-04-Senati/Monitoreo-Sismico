# Módulo: Reglas de alertas y Centro de alertas

Rutas `/reglas-alertas` (PDF §6.8) y `/alertas` (§6.9). Consume la API real
`/api/v1/alert-rules` y `/api/v1/alerts` (ver `docs/CONTRATOS.md` §7e y la decisión D19).

## Estructura

```
modules/alertas/
├─ ReglasAlertasPage.tsx            # Lista de reglas, nueva regla, ficha, activar/desactivar
├─ CentroAlertasPage.tsx            # Avisos con filtros (estado, severidad, regla) en la URL
├─ types.ts                         # Tipos que reflejan la API (regla, simulación, aviso, entrega)
├─ schemas/
│  └─ alertas.schema.ts             # Etiquetas, colores neutros, resúmenes y formulario ↔ API
├─ services/
│  └─ alertas.service.ts            # Llamadas a la API
└─ components/
   ├─ AvisoAlertas.tsx              # Avisos internos: no predicen, no son alertas oficiales
   ├─ Insignias.tsx                 # Severidad, estado del aviso y regla activa/inactiva
   ├─ TablaReglas.tsx               # Lista de reglas (clic → ficha)
   ├─ DetalleReglaModal.tsx         # Ficha, simulación y acciones según el rol
   ├─ EditorReglaModal.tsx          # Condición, zona, entrega, plantillas y simulación
   ├─ PanelSimulacion.tsx           # Cuántos avisos habría dado en los últimos N días
   ├─ TablaAvisos.tsx               # Lista de avisos (clic → detalle)
   └─ DetalleAvisoModal.tsx         # Sismo, mensaje, historial, entregas; aprobar/cancelar/acuse/reintento
```

## Reglas

- Una regla se crea y edita **inactiva**; solo un Administrador la activa. Para editar una
  activa hay que desactivarla (y volver a pedir su activación).
- Antes de activar, simularla con los sismos ya registrados: no crea avisos.
- Cancelar un aviso exige motivo. Todo queda en la Auditoría.
- Correo desactivado en el servidor = entrega "simulada" (se muestra así, nunca como enviada).
- Severidad y estado en colores neutros: son datos operativos, no niveles de peligro.
  Cada vista recuerda que es un aviso interno, no una alerta oficial (IGP/INDECI).
