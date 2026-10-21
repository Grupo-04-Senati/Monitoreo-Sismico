#!/bin/sh
# Bucle del contenedor de copias: una copia al arrancar y luego cada BACKUP_INTERVALO_SEG.
set -u
while true; do
  if ! sh /scripts/respaldar.sh; then
    echo "ERROR: la copia de seguridad falló ($(date -u +%FT%TZ))" >&2
  fi
  sleep "${BACKUP_INTERVALO_SEG:-86400}"
done
