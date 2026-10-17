# AGENTS.md — guía para cualquier asistente de IA que trabaje en Sismora

Este archivo lo lee **cualquier** IA (Claude Code, Copilot, Cursor, Codex u otra) y también sirve a las personas. Sismora la desarrolla un **equipo de 4 personas** sobre una repo compartida: tu trabajo es ayudar a *tu* persona sin pisar el de las demás.

## 1. Antes de escribir una línea (obligatorio, en este orden)

1. `git pull` de `main` y revisa la rama en la que estás.
2. Lee **[CONTEXTO.md](CONTEXTO.md)**: objetivo, límites no negociables, stack y decisiones cerradas. Si algo ahí contradice a otro documento, manda CONTEXTO.md. Debe mantenerse **corto** (tope ~120 líneas, ver `CONTEXTO.md`). El documento base original está en [docs/referencia/](docs/referencia/README.md): ábrelo solo para el detalle de un módulo, tabla o endpoint.
3. Lee de **[PROCESO.md](PROCESO.md)** solo la tabla *Resumen* y el apartado de **la fase de tu tarea** (su criterio de "terminada"). El resto —protocolo, checklist, bitácora— se abre únicamente si lo necesitas.
4. Lee **[docs/EQUIPO.md](docs/EQUIPO.md)**: quién es dueño de qué módulo y carpeta.
5. Lee **[docs/AVANCE.md](docs/AVANCE.md)**: qué está haciendo cada persona ahora y qué cambió en los últimos días. Con `git log --oneline -20` y los PR abiertos completas la foto.
6. Pregunta a tu persona cuál es **su** módulo de esta tarea. Si la tarea toca carpetas de otro dueño, **avísale** (§4) antes de editarlas.

**Presupuesto de lectura (ahorra tokens):** `CONTEXTO.md`, la parte indicada de `PROCESO.md`, `docs/EQUIPO.md` y `docs/AVANCE.md` bastan para empezar. **No leas** `DOCUMENTACION.md` (histórico), `EXPOSICION.md` ni el documento base de `docs/referencia/` salvo que la tarea lo exija: el primero se *actualiza* al cerrar una fase, el segundo se completa al final y el tercero solo se consulta para el detalle de un módulo, tabla o endpoint. Usa búsqueda (`grep`) en lugar de leer archivos enteros.

## 2. Límites del producto (nunca los rompas)

- Sismora **no predice terremotos** y **no emite alertas oficiales**. No escribas textos, nombres, etiquetas ni código que sugieran lo contrario.
- Cuatro categorías siempre distinguibles en datos y en interfaz: *observado*, *pendiente de validación*, *estimación experimental*, *comunicado oficial*. Usa un único componente de etiquetas (a crear en `apps/web/src/components/ui/`; no lo dupliques).
- Las estimaciones de ML llevan modelo, versión, incertidumbre, fecha y advertencia, y **nunca** se envían solas como alerta.
- Los colores no representan niveles de peligro (no hay escala validada).

## 3. Reglas de trabajo

- **No hagas `git commit` ni `git push` por tu cuenta.** Prepara el cambio, resume qué cambió y qué se verificó, y deja que tu persona haga el commit y el push (regla del proyecto).
- **Ramas, Pull Requests, revisión y secretos:** sigue [CONTRIBUTING.md](CONTRIBUTING.md) (una rama `fase-N-modulo-descripcion` por tarea, nunca trabajo directo en `main`, PR con CI en verde y revisión de otra persona, y cero secretos en el repo, en commits o en el chat).
- **No declares algo "hecho" sin haberlo ejecutado.** Corre las pruebas de lo que tocaste. Lo que no pudiste verificar (despliegue, Docker, otra máquina) se escribe como *no verificado*; no lo marques ✅.
- No inventes cifras, conteos de pruebas ni resultados. Los conteos solo se anotan al cerrar una fase.
- Cambios de **arquitectura o decisiones** (stack, modelo de datos compartido, roles, orden de fases): no los hagas por tu cuenta. Propónlos a tu persona; si se aprueban, quedan escritos en CONTEXTO.md (decisión) y DOCUMENTACION.md (razonamiento) en el mismo PR.

## 4. Contratos compartidos (donde más fácil se pisa el trabajo)

Estas piezas las usan varias personas; cámbialas con cuidado y avisando:

| Contrato | Dónde | Regla |
|---|---|---|
| **Migraciones** | `database/migrations/versions/` | **Una sola cabeza de Alembic.** Antes de crear una migración: `git pull` de `main` y `alembic heads`. Si alguien subió otra mientras trabajabas, rebasa y renumera. Una prueba falla si hay dos cabezas. Nunca edites una migración ya fusionada en `main`: crea otra. |
| **Esquemas de la API** | `services/api/app/schemas/` y `/api/v1` | Cambios incompatibles (renombrar, quitar campos) se avisan a quien consume ese endpoint. Se prefiere agregar campos. |
| **Matriz de permisos** | (se crea en la Fase 1) | Cada endpoint nuevo agrega su fila; si falta, la suite falla. |
| **Navegación y rutas** | `apps/web/src/App.tsx` (rutas) y `apps/web/src/components/layout/Sidebar.tsx` (menú y permisos) | Cada módulo cambia solo su línea. |
| **Configuración** | `services/api/app/core/config.py`, `.env.example` | Toda variable nueva se agrega a `.env.example` con comentario. |

## 5. Estructura y comandos

```
apps/web/            React 18 + TypeScript + Vite 5 + Tailwind 3  -> desde la raíz: npm run dev:web | npm run test:web | npm run build:web
services/api/        FastAPI                        -> python -m pytest (cuando exista la base de backend)
services/ingestion/  conectores de fuentes (Fase 2)
services/ml/         laboratorio de ML (Fase 6)
database/            migraciones Alembic, seeds, diagramas
infra/docker/        docker-compose y Dockerfiles (opcional)
```

Puesta en marcha, variables y pruebas: ver [README.md](README.md). Las pruebas con PostgreSQL se **omiten** si no hay `DATABASE_URL`; córrelas con `python -m pytest -rs` y revisa que no queden omitidas sin que lo sepas.

## 6. Estilo

- Idioma: textos de interfaz, mensajes de error y documentación en **español**; identificadores de código como ya están en el módulo que tocas (la API usa nombres en inglés para campos y rutas; la web usa nombres en español para componentes y módulos).
- Imita el código vecino: densidad de comentarios, nombres e idioma. Comentarios solo cuando explican el *porqué*.
- Fechas siempre en **UTC** en base de datos y API; la zona horaria (`America/Lima`) solo se aplica al mostrar.
- Dinero no aplica; magnitudes y coordenadas con validación de rango en API y con `CHECK` en la base.

## 7. Al terminar una tarea

1. Pruebas de lo que tocaste en verde (y las que ya existían).
2. Resumen para tu persona: qué cambió, qué verificaste, qué **no** verificaste, qué otro dueño debe enterarse.
3. Sugiere la línea para [docs/AVANCE.md](docs/AVANCE.md) y, si cambió una decisión o una fase, la actualización de CONTEXTO.md / PROCESO.md / DOCUMENTACION.md. Esas actualizaciones van **dentro del mismo PR** que el código.
