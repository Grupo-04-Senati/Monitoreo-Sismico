# Sistema de Monitoreo Sísmico — Frontend

Plataforma web empresarial de monitoreo sísmico, análisis estadístico y gestión de alertas.


## Documentación y equipo

Proyecto grupal de 4 personas con asistentes de IA. Empieza por `CONTEXTO.md`.

| Documento | Para qué sirve |
|---|---|
| [CONTEXTO.md](CONTEXTO.md) | Objetivo, límites y decisiones: léelo antes de decidir algo |
| [PROCESO.md](PROCESO.md) | Fases, integración por capas y criterios de "terminada" |
| [AGENTS.md](AGENTS.md) | Reglas para cualquier IA que trabaje en el repo |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Ramas, Pull Requests y revisión |
| [docs/EQUIPO.md](docs/EQUIPO.md) | Quién es dueño de qué módulo |
| [docs/AVANCE.md](docs/AVANCE.md) | Qué se está haciendo ahora |
| [DOCUMENTACION.md](DOCUMENTACION.md) | Registro técnico y razonamiento de las decisiones |
| [EXPOSICION.md](EXPOSICION.md) | Guía de la exposición académica (se completa al final) |
| [docs/referencia/](docs/referencia/README.md) | Documento base original (PDF) |

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

> Simuladas y solo para desarrollo: la interfaz aún no usa un login real. Se retiran al integrarlo (Fase 1).

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
