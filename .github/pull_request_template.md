## Qué cambia y por qué

<!-- Una o dos frases. Fase y módulo (p. ej. Fase 2 · Fuentes de datos). -->

## Cómo se verificó

- [ ] `python -m pytest -rs` (API) en verde, sin pruebas omitidas por error
- [ ] `npm run lint`, `npm test` y `npm run build` (web) en verde
- [ ] Probado a mano: <!-- qué pantalla o endpoint -->

**No verificado:** <!-- despliegue, Docker, otra máquina... o "nada" -->

## Contratos compartidos

- [ ] No toco migraciones, esquemas de API, matriz de permisos, `navigation.ts` ni `config.py`
- [ ] Sí los toco y avisé a su dueño (ver `docs/EQUIPO.md`): <!-- quién -->
- [ ] Hay una sola cabeza de Alembic (`alembic heads`)

## Documentación

- [ ] Actualicé `docs/AVANCE.md`
- [ ] Si cambié una decisión o una fase, actualicé CONTEXTO / PROCESO / DOCUMENTACION en este PR

## Seguridad y producto

- [ ] Sin secretos, claves ni datos personales en el diff
- [ ] No presenta estimaciones como alertas oficiales y mantiene separadas las cuatro categorías de dato
