# Guion de demostración

Recorrido de **todas las funciones** en ~25 minutos, en el orden que exigen sus
dependencias (un dataset antes que un modelo, un modelo antes que una estimación, una
regla activa antes que los avisos). Verificado de punta a punta el 2026-10-21 con el
catálogo real (7 609 sismos). Los números de referencia pueden variar un poco con los datos.

> Mensaje clave para el público: es una plataforma **privada** para el personal de una
> empresa con activos en zonas sísmicas. Usa sismos **ya ocurridos** y publicados por el
> USGS. **No predice sismos** ni reemplaza al IGP o INDECI: sus avisos son internos y sus
> estimaciones son experimentales (siempre en violeta y con su incertidumbre).

## Antes de la demo (una vez, ~10 min)

> **Demo en línea** (Render, dirección pública): seguir `docs/DEMO_EN_LINEA.md`, que hace
> estos mismos pasos contra la base de Render. Lo de abajo es para una demo en local.

En `services/api`, con el entorno virtual:

```bash
# 1. Base al día (migraciones) y departamento de cada sismo
python -m alembic upgrade head
python -m app.scripts.asignar_regiones

# 2. Cuentas de demo: elija una contraseña (8+ caracteres, con número y símbolo)
#    PowerShell:  $env:DEMO_PASSWORD="…"      Bash:  export DEMO_PASSWORD='…'
python -m app.scripts.preparar_demo cuentas

# 3. Ver qué falta
python -m app.scripts.preparar_demo estado
```

Cuentas (todas con la contraseña elegida):

| Rol | Correo |
|---|---|
| Administrador | demo-admin@empresa-ejemplo.pe |
| Analista | demo-analyst@empresa-ejemplo.pe |
| Operador de alertas | demo-alert-operator@empresa-ejemplo.pe |
| Auditor | demo-auditor@empresa-ejemplo.pe |
| Solo lectura | demo-viewer@empresa-ejemplo.pe |

Levantar la API (`uvicorn app.main:app --port 8000`) y la web (`npm run dev:web` en la
raíz) y abrir `http://localhost:5173`. Consejo: una ventana de navegador privada por rol,
para cambiar de usuario sin cerrar sesión.

## Recorrido

### 1. Acceso y roles (Administrador) — 2 min
- Entrar como **demo-admin**. Mostrar el menú completo por secciones.
- Probar una contraseña incorrecta en otra ventana: mensaje genérico (no revela si el
  correo existe). Tras 5 fallos la cuenta se bloquea 15 minutos.

### 2. Dashboard, Eventos y Mapa — 4 min
- **Dashboard**: indicadores del periodo, serie diaria, top de regiones, estado de la fuente.
- **Eventos**: periodo personalizado `2025-01-01` a `2025-12-31` y magnitud mínima `5`.
  Abrir un sismo → magnitud, profundidad, hora (UTC-5) y, en *Procedencia y datos
  técnicos*, el **enlace al evento en el USGS**.
- **Mapa sísmico**: se carga solo la capa **Límites departamentales (INEI)**, 25 de 25
  regiones, sombreadas por número de sismos. Clic en Arequipa → filtra. Luego **Mundo · en
  vivo**: sismos M4.5+ del planeta (7 días), el Cinturón de Fuego y el recuadro de la zona
  del Perú; clic en el más fuerte → detalle y enlace al USGS. En el Dashboard, la tarjeta
  "Mapa de eventos" tiene los botones Perú / Mundo.
- **Análisis estadístico**: gráficos con los mismos filtros.

### 3. Fuentes de datos — 1 min
- Ficha del USGS, ejecuciones, latencia y calidad. *Sincronización manual* trae lo nuevo
  y aplica las **correcciones** que el USGS publica después (D27).

### 4. Preparación de datos (Analista → Administrador) — 3 min
- Como **demo-analyst** → *Nuevo dataset*: nombre `demo_conteo_m45_2000_2025`, fuente
  USGS, desde `2000-01-01`, hasta `2025-12-31`, magnitud mínima `4.5`, eventos sin
  profundidad: *Imputar con la mediana*, fecha de corte `2021-01-01` → **Crear dataset**.
  Referencia: ~3 400 filas, informe de calidad y vista previa con la partición.
- El analista **no** puede aprobarlo. Como **demo-admin** → abrir el dataset → **Aprobar
  dataset** (queda congelado: ni las correcciones de la fuente lo cambian).

### 5. Modelos ML (Analista → Administrador) — 3 min
- Como analista → *Nuevo experimento*: tarea *Conteo semanal de sismos*, el dataset aprobado →
  **Entrenar**. Se compara con la media histórica y la regresión lineal (métricas en la
  partición de prueba, semilla y versiones de librerías guardadas).
- Como admin → abrir el experimento → **Aprobar modelo** con sus limitaciones.

### 6. Estimaciones (Analista → Administrador) — 2 min
- Como analista → *Nueva estimación* con el modelo aprobado → **Generar estimación**.
  Referencia: ~2 sismos para la semana en curso, intervalo del 90 % y advertencias.
  Todo en **violeta**: es experimental, no es una alerta.
- Como admin → **Publicar** (sigue siendo experimental).

### 7. Reglas de alertas (Operador → Administrador) — 3 min
- Como **demo-alert-operator** → **Nueva regla**: nombre `Demo · Mina Arequipa M4.5`,
  magnitud mínima `4.5`, zona *Radio alrededor de un punto*: lugar `Mina Arequipa`, radio
  `300`, latitud `-16.4`, longitud `-71.5`, espera `0`, requiere aprobación.
- **Simular** con *Últimos 1 año* → referencia: ~26 sismos habrían generado aviso.
- **Crear regla**: nace inactiva y el operador **no** ve *Activar*. Como admin → abrir la
  regla → **Activar**.

### 8. Centro de alertas (Operador) — 3 min
- Hacer llegar sismos, de una de estas dos formas:
  - **En vivo (demo en línea)**: como admin → Configuración → *Simulador de sismos* →
    zona *Mina Arequipa*, magnitud `5.2`, *Uno con 2 réplicas* → **Simular sismo** →
    3 sismos ficticios `[SIMULADO]` con departamento Arequipa y sus avisos. Mostrar que
    también aparecen en Eventos (24 h), Fuentes de datos (ejecución propia) y Auditoría.
  - **Con sismos reales**: en la terminal (los sismos de los últimos 60 días, como si
    acabaran de llegar) `python -m app.scripts.preparar_demo avisos --dias 60` →
    referencia: ~4 avisos.
- Como operador → **Centro de alertas** → pestaña *Pendiente de aprobación* → abrir uno:
  sismo observado, mensaje ("no es una alerta oficial"), historial.
- **Aprobar y enviar** → entrega *Plataforma: Entregada* (y *Correo: Simulada* si la regla
  usa correo y el SMTP está desactivado). Luego **Dar acuse de recibo**. Cancelar otro con
  motivo. El Dashboard muestra los *avisos por atender*.

### 9. Reportes (Analista) — 1 min
- *Nuevo informe*: tipo *Eventos sísmicos*, formato *Excel (.xlsx)*, *Últimos 90 días* → **Generar informe** →
  descargar. La cabecera trae fecha de corte, filtros, fuente y solicitante.

### 10. Auditoría (Auditor) — 1 min
- Como **demo-auditor** → todo lo hecho en la demo con usuario, fecha y antes/después.
  Filtrar por *Regla activada* o por un usuario. **Exportar CSV** (la exportación también
  queda registrada).

### 11. Configuración (Administrador) — 2 min
- **Estado del sistema**: base, ingesta, avisos, latencia, límite de acceso, copias.
- Cambiar *Vigencia de los reportes* de 24 a 36 h → aparece en el control de cambios.
- Retención de la auditoría (purga protegida: nunca menos de 365 días).

### 12. Solo lectura — 30 s
- Como **demo-viewer**: solo Dashboard, Eventos, Mapa y Reportes. Escribir
  `/configuracion` en la barra → *Acceso denegado*.

## Si algo no aparece

- `python -m app.scripts.preparar_demo estado` dice qué módulo no tiene datos aún y qué
  paso del guion lo crea.
- Sin avisos tras el paso 8: comprobar que la regla esté **activa** y ampliar `--dias`.
- Volver a empezar: crear otro dataset o regla con otro nombre (los aprobados no se
  borran, por diseño).

## Cierre (lo que respalda la demo)

- 414 pruebas automáticas del backend, 18 de pantallas (incluida accesibilidad WCAG AA),
  despliegue con HTTPS y simulacro de restauración verificados en cada cambio (CI).
- Decisiones documentadas (D14–D30), manual técnico y checklist de aceptación en `docs/`.
