#!/bin/sh
# Copia de seguridad de PostgreSQL (formato custom, para pg_restore) con retención.
# Usa las variables estándar de libpq: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
#   BACKUP_DIR      carpeta de destino (por defecto /backups)
#   RETENCION_DIAS  se borran las copias más antiguas (por defecto 14)
set -eu

DESTINO="${BACKUP_DIR:-/backups}"
RETENCION="${RETENCION_DIAS:-14}"
BASE="${PGDATABASE:?Defina PGDATABASE}"

mkdir -p "$DESTINO"
SELLO=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVO="$DESTINO/${BASE}_${SELLO}.dump"

pg_dump --format=custom --no-owner --no-privileges --file="$ARCHIVO.tmp"
# Solo se da por buena si pg_restore puede leer su índice.
pg_restore --list "$ARCHIVO.tmp" > /dev/null
mv "$ARCHIVO.tmp" "$ARCHIVO"

find "$DESTINO" -type f -name "${BASE}_*.dump" -mtime +"$RETENCION" -exec rm -f {} \;
echo "Copia creada: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
