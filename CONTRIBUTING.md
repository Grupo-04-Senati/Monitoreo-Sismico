# Cómo trabajamos en equipo

Sismora la desarrollan 4 personas sobre una repo compartida. Estas reglas valen para las personas y para sus asistentes de IA (ver [AGENTS.md](AGENTS.md)).

## 1. Flujo diario

1. **Actualiza:** `git switch main` y `git pull`.
2. **Revisa** [docs/AVANCE.md](docs/AVANCE.md) y los PR abiertos para ver qué hacen los demás.
3. **Crea tu rama** desde `main`: `fase-N-modulo-descripcion` (p. ej. `fase-2-fuentes-usgs`).
4. **Trabaja** en carpetas de tu módulo ([docs/EQUIPO.md](docs/EQUIPO.md)). Si necesitas tocar las de otra persona, avísale antes.
5. **Verifica** localmente: `python -m pytest -rs` (API) y `npm run lint && npm test && npm run build` (web).
6. **Commit y push los haces tú**, no tu IA. Mensajes con el formato `tipo: resumen` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`).
7. **Abre un Pull Request** hacia `main` con la plantilla. Pide revisión a una persona que no sea quien lo escribió.
8. **Merge** solo con CI en verde y al menos 1 aprobación. Después, borra la rama y haz `git pull` en `main`.

## 2. Reglas que evitan problemas

- **Nunca** trabajes ni subas directo a `main`.
- **PR pequeños** (idealmente menos de ~400 líneas de cambio). Si crece, divídelo.
- **Migraciones:** una sola cabeza de Alembic. Si al hacer `git pull` aparece otra migración, rebasa tu rama y renumera la tuya. No edites migraciones ya fusionadas.
- **Contratos compartidos** (migraciones, esquemas de API, matriz de permisos, `navigation.ts`, `config.py`): cámbialos avisando por el grupo o por el PR.
- **Secretos:** cada persona usa su propio `.env` local. No se comparten claves por el chat ni se suben. Las claves compartidas (base de datos de despliegue) las administra la persona de plataforma en los paneles de Render/Vercel.
- **Documentación junto al código:** si tu PR cambia una decisión, una fase o cómo se ejecuta algo, actualiza CONTEXTO.md, PROCESO.md, DOCUMENTACION.md o el README en **el mismo PR**.
- **Conflictos en documentos** (sobre todo `docs/AVANCE.md`): resuélvelos conservando las líneas de ambas personas.

## 3. Revisión de PR (qué mirar)

- ¿Pasa el CI y hay pruebas de lo nuevo?
- ¿Respeta los límites del producto (no predice, no es oficial, categorías separadas)?
- ¿Toca contratos compartidos? ¿Avisó a sus dueños?
- ¿Hay secretos, datos personales o rutas locales en el diff?
- ¿La documentación quedó al día? ¿Lo "no verificado" está dicho con honestidad?

## 4. Cierre de fase

Al terminar una fase, la persona responsable de la fase (ver EQUIPO.md) actualiza PROCESO.md (estado y bitácora de cierres), CONTEXTO.md y DOCUMENTACION.md, y el equipo la revisa en un PR de cierre. Los conteos de pruebas se anotan **solo** en ese momento.

## 5. Ramas y despliegue

`main` siempre debe estar en verde y es lo que despliegan Render y Vercel. Una rama rota no se fusiona.
