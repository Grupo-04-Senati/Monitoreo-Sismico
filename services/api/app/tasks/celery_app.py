"""Configuración de Celery (broker/backend y programación de la ingesta)."""

from datetime import timedelta

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "sismo_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

#: Programación: la ingesta corre cada `INGESTION_INTERVAL_MINUTES` (15 por defecto).
celery_app.conf.beat_schedule = {
    "ingesta-programada": {
        "task": "app.tasks.ingestion_tasks.sync_all_sources",
        "schedule": timedelta(minutes=settings.INGESTION_INTERVAL_MINUTES),
    }
}

celery_app.autodiscover_tasks(["app.tasks"])
