"""Comprueba el cableado de Celery (D5) sin necesitar un servidor Redis: la tarea se ejecuta localmente con `apply`."""
from app.tasks.celery_app import celery_app
from app.tasks.ingestion_tasks import sync_data_source


def test_la_tarea_de_ingesta_esta_registrada():
    assert "app.tasks.ingestion_tasks.sync_data_source" in celery_app.tasks


def test_la_tarea_se_ejecuta_localmente_sin_broker():
    assert sync_data_source.apply(args=["fuente-1"]).get() == {"source_id": "fuente-1", "status": "synced"}


def test_celery_usa_json_y_utc():
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.enable_utc is True
