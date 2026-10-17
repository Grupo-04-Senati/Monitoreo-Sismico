from app.tasks.celery_app import celery_app


@celery_app.task
def sync_data_source(source_id: str):
    """Tarea asíncrona para sincronizar una fuente de datos sísmicos."""
    return {"source_id": source_id, "status": "synced"}
