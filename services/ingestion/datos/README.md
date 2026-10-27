# Datos geográficos

`peru_departamental_simple.geojson`: polígonos de los 25 departamentos del Perú (propiedad
`NOMBDEP`), tomados sin modificar de https://github.com/juaneladio/peru-geojson
(licencia MPL-2.0; geometría basada en los límites del INEI). Es el mismo archivo con el
que se generó el fondo de la interfaz (`apps/web/src/components/background/deptPaths.ts`).

Lo usa `ingestion/geografia.py` para asignar el departamento de cada sismo y la API lo
sirve como capa base del mapa (`GET /api/v1/regions/geojson`). Si se reemplaza, debe
seguir teniendo `NOMBDEP` con los 25 nombres.

`mundo_paises_110m.geojson`: contornos de 177 países para la vista mundial del mapa (D30),
generados de `ne_110m_admin_0_countries.geojson` de Natural Earth v5.1.2
(https://github.com/nvkelso/natural-earth-vector, **dominio público**). Solo se conservan
`nombre` (nombre en español) e `iso` (ISO 3166-1 alfa-3) y las coordenadas se redondean a
2 decimales (≈1 km) para que pese ~170 KB. La API lo sirve en `GET /api/v1/regions/mundo`.
Es solo un fondo de referencia: no se usa para asignar ni contar sismos.
