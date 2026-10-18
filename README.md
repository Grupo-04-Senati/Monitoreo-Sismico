# Sistema de Monitoreo Sísmico — Frontend

Plataforma web empresarial de monitoreo sísmico, análisis estadístico y gestión de alertas.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- npm (incluido con Node.js)

## Inicio rápido

### Opción A — Archivo automático (Windows)

Doble clic en `iniciar.bat` desde la raíz del proyecto.

### Opción B — Manual

```bash
# 1. Instalar dependencias
cd apps/web
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

Abrir **http://localhost:5173** en el navegador.

## Primera cuenta (administrador)

La base de datos arranca **vacía** (sin cuentas ni datos de ejemplo). El registro
público deja las cuentas en estado pendiente y solo un administrador puede
aprobarlas, así que la primera cuenta se crea por consola:

```bash
cd services/api            # con el entorno virtual activo
python -m app.scripts.crear_admin --email admin@tu-dominio.pe
```

La contraseña **no se pasa por parámetro** (quedaría en el historial): el script
la pide de forma interactiva, o la toma de la variable de entorno
`SISMO_ADMIN_PASSWORD` en entornos no interactivos. No se guarda ninguna
contraseña en el repositorio.

## Más documentación

- `AGENTS.md` — reparto de módulos, reglas y contratos del equipo.
- `docs/HANDOFF.md` — cómo levantar todo el sistema y qué queda pendiente.
- `docs/CONTRATOS.md`, `docs/DECISIONES.md` — contratos y decisiones de diseño.

## Estructura del proyecto

```
apps/web/src/
├── app/                    # Auth, guards, layout ERP
│   ├── auth/               # Contexto, Login, Registro
│   ├── guards/             # RouteGuard por permiso
├── modules/                # 13 módulos funcionales
│   ├── dashboard/          # Dashboard operativo
│   ├── eventos/            # Eventos sísmicos
│   ├── mapa-sismico/       # Mapa geográfico
│   ├── analisis/           # Análisis estadístico
│   ├── preparacion-datos/  # Control de calidad
│   ├── modelos-ml/         # Experimentos ML
│   ├── estimaciones/       # Estimaciones experimentales
│   ├── alertas/            # Reglas y centro de alertas
│   ├── fuentes-datos/      # Conectores de datos
│   ├── reportes/           # Generación de reportes
│   ├── usuarios-roles/     # Administración de usuarios
│   ├── auditoria/          # Historial de acciones
│   └── configuracion/      # Parámetros del sistema
├── components/             # UI reutilizable
│   ├── ui/                 # Card, DataTable, ExpandModal, Combobox...
│   ├── charts/             # AreaChart, BarChart, HBarChart, Sparkline
│   └── layout/             # Sidebar, Topbar, Breadcrumbs
├── lib/                    # Utilidades (catálogo, formatos, ancla temporal)
├── types/                  # Tipos TypeScript
├── hooks/                  # Hooks personalizados
└── schemas/                # Validación de formularios
```

## Reglas de diseño (obligatorias)

- **No confundir** estimaciones ML con alertas oficiales. Etiquetas visibles y distintas.
- **No usar** colores que sugieran nivel oficial de peligro sísmico.
- Toda gráfica muestra **fuente, periodo, filtros, tamaño de muestra y hora de actualización**.
- **Accesibilidad**: contraste, navegación por teclado, labels, estados vacíos y skeleton.
- **Identidad**: azul marino (navegación), cyan (acciones), blanco/gris (superficies).
- **Responsive** y modo claro/oscuro.

## Roles

| Rol | Acceso |
|---|---|
| Administrador | Todos los módulos |
| Analista | Dashboard, eventos, mapa, análisis, datos, ML, estimaciones, reportes |
| Operador de alertas | Dashboard, eventos, mapa, reglas, alertas |
| Auditor | Dashboard, eventos, mapa, análisis, auditoría, reportes |
| Solo lectura | Dashboard, eventos, mapa |
