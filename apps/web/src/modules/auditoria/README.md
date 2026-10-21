# Módulo: Auditoría

Ruta `/auditoria` (PDF §6.13). Consume `/api/v1/audit-logs` (ver `docs/CONTRATOS.md` §5,
D14 y D20). Administrador y Auditor.

## Estructura

```
modules/auditoria/
├─ AuditoriaPage.tsx               # Aviso, filtros (en la URL), exportar, tabla y detalle
├─ types.ts                        # Registro, página, valores de filtro
├─ schemas/auditoria.schema.ts     # Etiquetas de acciones y entidades, antes/después
├─ services/auditoria.service.ts   # Lista, valores de filtro y exportación CSV
└─ components/
   ├─ FiltrosAuditoria.tsx         # Usuario, acción, entidad, id y rango de días (UTC-5)
   ├─ TablaAuditoria.tsx           # Bitácora (clic → detalle); ◆ acciones sensibles
   └─ DetalleRegistroModal.tsx     # Ficha y tabla antes/después; historial de la entidad
```

## Reglas

- Solo lectura: la base impide editar o borrar registros (salvo la purga de retención).
- Exportar queda registrado como `auditoria_exportada` (con filtros y filas).
- Acciones sin etiqueta se muestran con su clave técnica: nunca se ocultan.
