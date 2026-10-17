# Equipo y asignaciones

> **Propuesta inicial, por confirmar.** Reemplazar `Persona A–D` por los nombres y usuarios de GitHub reales, y ajustar el reparto al acordarlo. Cualquier cambio de dueño se hace por PR.

## Integrantes

| Letra | Nombre | Usuario de GitHub | Contacto del grupo |
|---|---|---|---|
| A | *(por completar)* | | |
| B | *(por completar)* | | |
| C | *(por completar)* | | |
| D | *(por completar)* | | |

## Dueños por área

El **dueño** responde por el diseño, la calidad y la revisión de su área. Otras personas pueden aportar por PR, avisándole antes.

| Área | Módulos del documento base | Carpetas | Fases | Dueño (propuesto) |
|---|---|---|---|---|
| **Plataforma e identidad** | Usuarios y roles, Auditoría, Configuración, CI/CD, despliegue, seguridad | `services/api/app/core`, `services/api/app/routers/{auth,usuarios,auditoria}.py`, `apps/web/src/app/{auth,guards}`, `apps/web/src/modules/{usuarios-roles,auditoria,configuracion}`, `infra/`, `.github/` | 0, 1, 8 | A |
| **Datos sísmicos** | Fuentes de datos, Eventos sísmicos, Preparación de datos | `services/ingestion/`, `services/api/app/routers/{eventos,fuentes,datasets}.py`, `apps/web/src/modules/{eventos,fuentes-datos,preparacion-datos}`, `database/migrations` de esas tablas | 2, 4 (calidad) | B |
| **Analítica y visualización** | Dashboard, Mapa, Análisis estadístico, Reportes | `apps/web/src/modules/{dashboard,mapa-sismico,analisis,reportes}`, `apps/web/src/components/charts`, `services/api/app/routers/{dashboard,mapa,analisis,reportes}.py` | 3, 4 (análisis), 7 | C |
| **Alertas y ML** | Reglas de alertas, Centro de alertas, Modelos de ML, Estimaciones experimentales | `services/ml/`, `services/api/app/services/notifications/`, `services/api/app/routers/{alert_rules,alerts,ml,estimaciones}.py`, `apps/web/src/modules/{alertas,modelos-ml,estimaciones}` | 5, 6 | D |

**Por qué este reparto:** separa carpetas casi disjuntas (menos conflictos) y ordena la dependencia: **B publica los eventos**, y C y D los consumen. Por eso el esquema de `seismic_events` y los endpoints de eventos (Fase 2) son el primer contrato compartido: B lo define y lo avisa antes de que C y D construyan encima.

## Dependencias entre áreas

```
A (identidad, roles, despliegue) ──▶ todas las áreas necesitan login y roles (Fase 1)
B (eventos) ──▶ C (dashboard, mapa, análisis) y D (reglas de alertas, datasets de ML)
B (datasets) ──▶ D (experimentos de ML)
```

Mientras no existan los eventos reales (Fase 2), C y D pueden avanzar con datos de ejemplo (*seeds* en `database/seeds/`) siguiendo el esquema que defina B.

## Revisión cruzada

Todo PR lo revisa **otra persona**. Sugerencia de rotación: A revisa a B, B a C, C a D, D a A. Los cambios en contratos compartidos los revisa además el dueño del área afectada.

## Cierre de cada fase

Responsable de actualizar PROCESO.md, CONTEXTO.md y DOCUMENTACION.md al cerrar una fase: el **dueño del área principal** de esa fase (Fase 0, 1, 8: A; 2: B; 3: C; 4: B y C; 5 y 6: D; 7: C).
