# Módulo: Configuración

Ruta `/configuracion` (PDF §6.13). Consume `/api/v1/settings` (ver `docs/CONTRATOS.md` §7f
y D20). Solo Administrador.

## Estructura

```
modules/configuracion/
├─ ConfiguracionPage.tsx                # Parámetros, retención, control de cambios y entorno
├─ types.ts                             # Parámetro, entorno, cambio y retención
├─ services/configuracion.service.ts    # Llamadas a la API
└─ components/
   ├─ TarjetaParametro.tsx              # Valor, rango, efecto real y último cambio
   ├─ PanelRetencion.tsx                # Vista previa y purga con confirmación escrita
   ├─ HistorialCambios.tsx              # Cambios y purgas, tomados de la auditoría
   └─ PanelEntorno.tsx                  # .env en solo lectura, sin secretos, con advertencias
```

## Reglas

- Solo parámetros que el sistema usa de verdad; cada cambio se audita (antes/después).
- La purga borra lo más antiguo que la retención; la base protege siempre los últimos 365 días.
- Secretos y variables de entorno no se editan desde la web.
