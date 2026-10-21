# Prueba de carga

Cuántos usuarios simultáneos aguanta la API navegando **Dashboard y Eventos** (PDF Fase 9
y §12). Script: `tests/carga/carga.py` (solo lecturas; no modifica datos).

## Escenario

- Cada usuario virtual repite una visita al **Dashboard** (sesión, metadatos, resumen,
  fuentes, ejecuciones, calidad, catálogo de 30 días) o a **Eventos** (catálogo del
  periodo, filtro por magnitud y una página filtrada), al azar.
- Periodo (30 d a 5 años) y magnitud mínima varían al azar para no medir solo la caché.
- **Ritmo realista**: pausa de lectura de 10–30 s entre pantallas y llegadas repartidas.
  **Ritmo agresivo**: pausa de 1–3 s (cada usuario virtual equivale a varios reales).
- Objetivo: p95 ≤ 1 000 ms y errores ≤ 1 %.

## Resultados (2026-10-21)

Entorno: portátil de desarrollo (Windows 11, 12 núcleos), PostgreSQL 18 en la misma
máquina, API como en producción (sin `--reload`), copia de la base real (7 609 sismos).

| Usuarios | Ritmo | Procesos | Pet/s | p50 | p95 | Errores | Resultado |
|---:|---|---:|---:|---:|---:|---:|---|
| 50 | realista | 1 | 9,6 | 76 ms | 560 ms | 0 | ✔ |
| 100 | realista | 1 | 17,7 | 45 ms | 676 ms | 0 | ✔ |
| 200 | realista | 1 | 28,4 | 171 ms | 3 502 ms | 0 | ✘ (lento, sin errores) |
| 10 | agresivo | 1 | 19,9 | 127 ms | 877 ms | 0 | ✔ |
| 50 | agresivo | 1 | 55,5 | 557 ms | 1 844 ms | 0 | ✘ (saturado) |

**Conclusión:** un proceso de la API atiende con holgura **100 usuarios simultáneos** con
uso realista (p95 < 0,7 s) y no da errores ni con 200: se vuelve lenta, no se cae. El
límite es la CPU de un proceso de Python (un núcleo): sin carga, cada llamada tarda
13–70 ms; con muchas a la vez esperan en fila.

## Lo que no se pudo medir aquí

- **Escalado con varios procesos.** En Windows, uvicorn no reparte bien entre procesos
  (uno atendió ~70 % de las peticiones) y abrir muchas conexiones locales a la vez
  provoca reintentos TCP de ~21 s. Debe medirse en el servidor Linux de producción.
- La base estaba en la misma máquina que la API y el generador de carga: en producción
  cada pieza tiene su contenedor y los números deberían ser iguales o mejores.

## Recomendaciones

1. **Para más de ~100 usuarios simultáneos**, subir `API_WORKERS` en Linux. Antes hay que
   mover el límite de intentos de acceso a Redis (hoy vive en memoria de cada proceso:
   con 4 procesos permitiría 4 veces más intentos; ver D22).
2. **Caché en el servidor del catálogo compacto** (unos 30 s, invalidada tras cada
   sincronización): es la respuesta más pesada (hasta ~490 KB para 5 años) y se repite
   mucho entre usuarios.
3. Repetir esta prueba en el servidor de producción antes de abrir el sistema a toda la
   empresa y después de cambios grandes.

## Cómo repetirla

Contra una **copia** de la base, nunca contra producción en horario de uso:

```bash
# 1. Copiar la base (usa los scripts de copias) y crear una cuenta de prueba
PGDATABASE=sismo_db BACKUP_DIR=/tmp/copia sh infra/backup/respaldar.sh
sh infra/backup/restaurar.sh /tmp/copia/<archivo>.dump sismo_carga
cd services/api
POSTGRES_DB=sismo_carga SISMO_ADMIN_PASSWORD='...' python -m app.scripts.crear_admin --email carga@empresa-ejemplo.pe

# 2. Levantar la API como en producción, en otro puerto
POSTGRES_DB=sismo_carga python -m uvicorn app.main:app --port 8020 --log-level warning

# 3. Ejecutar (otra terminal, desde la raíz)
CARGA_PASSWORD='...' python tests/carga/carga.py --email carga@empresa-ejemplo.pe \
  --usuarios 100 --duracion 120 --pausa-min 10 --pausa-max 30

# 4. Borrar la copia
dropdb --force sismo_carga
```

Opciones: `--url` (una o varias, separadas por coma), `--p95-max-ms`, `--errores-max`.
El script termina con código 1 si no cumple el objetivo.
