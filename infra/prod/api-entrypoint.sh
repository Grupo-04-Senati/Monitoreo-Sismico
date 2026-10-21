#!/bin/sh
# Punto de entrada de la imagen de la API.
#   api    → aplica las migraciones y arranca uvicorn (sin --reload).
#   worker → worker de Celery (sincronizaciones).
#   beat   → programador de Celery (ingesta cada INGESTION_INTERVAL_MINUTES).
set -eu

case "${1:-api}" in
  api)
    alembic upgrade head
    # El límite de intentos de acceso se cuenta en Redis: varios procesos son seguros (D25).
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 \
      --workers "${API_WORKERS:-1}" --proxy-headers --forwarded-allow-ips="*"
    ;;
  worker)
    exec celery -A app.tasks.celery_app worker --loglevel=info --concurrency="${WORKER_CONCURRENCY:-1}"
    ;;
  beat)
    exec celery -A app.tasks.celery_app beat --loglevel=info --schedule /tmp/celerybeat-schedule
    ;;
  *)
    exec "$@"
    ;;
esac
