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

## Cuentas de prueba

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@sismo.pe` | `Admin123!` | Administrador |
| `analista@sismo.pe` | `Analista123!` | Analista |
| `operador@sismo.pe` | `Operador123!` | Operador de alertas |
| `auditor@sismo.pe` | `Auditor123!` | Auditor |

## Estructura del proyecto

```
apps/web/src/
├── app/                    # Auth, guards, layout ERP
│   ├── auth/               # Contexto, Login, Registro
│   ├── guards/             # RouteGuard por permiso
├── modules/                # 13 módulos funcionales
│   ├── dashboard/          # Dashboard con datos mock
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
│   ├── ui/                 # Card, KpiCard, DataTable, Drawer...
│   ├── charts/             # MiniBarChart
│   └── layout/             # Sidebar, Topbar, PageTemplate
├── lib/
│   └── mock/               # Datos mock para desarrollo
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
