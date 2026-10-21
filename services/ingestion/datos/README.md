# Datos geográficos

`peru_departamental_simple.geojson`: polígonos de los 25 departamentos del Perú (propiedad
`NOMBDEP`), tomados sin modificar de https://github.com/juaneladio/peru-geojson
(licencia MPL-2.0; geometría basada en los límites del INEI). Es el mismo archivo con el
que se generó el fondo de la interfaz (`apps/web/src/components/background/deptPaths.ts`).

Lo usa `ingestion/geografia.py` para asignar el departamento de cada sismo y la API lo
sirve como capa base del mapa (`GET /api/v1/regions/geojson`). Si se reemplaza, debe
seguir teniendo `NOMBDEP` con los 25 nombres.
