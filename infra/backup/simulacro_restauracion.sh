#!/bin/sh
# Simulacro de restauración (PDF §12): restaura la copia más reciente (o la indicada)
# en una base temporal, la compara con la base en uso y la borra. Falla si la copia no
# se puede restaurar, si su migración no coincide o si una tabla con datos sale vacía.
#   simulacro_restauracion.sh [archivo.dump]
set -eu

DIR="${BACKUP_DIR:-/backups}"
BASE="${PGDATABASE:?Defina PGDATABASE}"
ARCHIVO="${1:-$(ls -1t "$DIR/${BASE}"_*.dump 2>/dev/null | head -n 1)}"
if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "No hay copias en $DIR" >&2
  exit 1
fi

PRUEBA="${BASE}_simulacro"
borrar_prueba() {
  psql -d postgres -qc "DROP DATABASE IF EXISTS \"$PRUEBA\"" > /dev/null 2>&1 || true
}
borrar_prueba
trap borrar_prueba EXIT

echo "Simulacro con $ARCHIVO"
sh "$(dirname "$0")/restaurar.sh" "$ARCHIVO" "$PRUEBA" > /dev/null

FALLO=0
V_ORIGEN=$(psql -d "$BASE" -tAc "SELECT version_num FROM alembic_version")
V_COPIA=$(psql -d "$PRUEBA" -tAc "SELECT version_num FROM alembic_version")
echo "Migración: en uso $V_ORIGEN | copia $V_COPIA"
if [ "$V_ORIGEN" != "$V_COPIA" ]; then
  echo "  X la copia es de otra migración"
  FALLO=1
fi

printf "%-18s %12s %12s\n" "tabla" "en uso" "copia"
for T in seismic_events users audit_logs data_sources ingestion_runs alert_rules alerts datasets; do
  O=$(psql -d "$BASE" -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo "-")
  C=$(psql -d "$PRUEBA" -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo "-")
  NOTA=""
  if [ "$O" != "$C" ]; then NOTA="(cambió después de la copia)"; fi
  if [ "$C" = "0" ] && [ "$O" != "0" ] && [ "$O" != "-" ]; then NOTA="X vacía en la copia"; FALLO=1; fi
  printf "%-18s %12s %12s %s\n" "$T" "$O" "$C" "$NOTA"
done

if [ "$FALLO" -ne 0 ]; then
  echo "SIMULACRO FALLIDO"
  exit 1
fi
echo "Simulacro correcto: la copia se restaura y contiene los datos."
