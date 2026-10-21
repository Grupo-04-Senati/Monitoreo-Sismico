#!/bin/sh
# Restaura una copia en una base NUEVA (nunca sobre otra existente).
#   restaurar.sh <archivo.dump> <base_destino>
# Para reemplazar la base en uso: detener la API, renombrar la base vieja a mano y
# restaurar con el nombre original (ver docs/DESPLIEGUE.md, "Recuperación").
set -eu

ARCHIVO="${1:?Uso: restaurar.sh <archivo.dump> <base_destino>}"
DESTINO="${2:?Uso: restaurar.sh <archivo.dump> <base_destino>}"
[ -f "$ARCHIVO" ] || { echo "No existe $ARCHIVO" >&2; exit 1; }

case "$DESTINO" in
  *[!a-zA-Z0-9_]*) echo "Nombre de base no válido: use letras, números y _" >&2; exit 1 ;;
esac

EXISTE=$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DESTINO'")
if [ "$EXISTE" = "1" ]; then
  echo "La base '$DESTINO' ya existe: elija otro nombre o bórrela antes a mano." >&2
  exit 1
fi

createdb "$DESTINO"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$DESTINO" "$ARCHIVO"
echo "Restaurada en '$DESTINO' (migración $(psql -d "$DESTINO" -tAc 'SELECT version_num FROM alembic_version'))"
