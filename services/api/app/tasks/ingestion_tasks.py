"""Tareas asíncronas de ingesta (Celery).

La lógica real vive en `app.services.ingestion_runner`; aquí solo se envuelve en
una tarea para poder programarla (beat) o lanzarla manualmente desde la API.
"""

from __future__ import annotations

import asyncio

from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.ingestion_tasks.sync_data_source")
def sync_data_source(
    source_id: str,
    run_id: str | None = None,
    triggered_by: str = "scheduled",
    actor_id: str | None = None,
    correlation_id: str | None = None,
) -> str:
    """Sincroniza una fuente y devuelve el id de la ejecución."""
    from app.services.ingestion_runner import ejecutar_sincronizacion

    return asyncio.run(
        ejecutar_sincronizacion(
            source_id,
            run_id=run_id,
            triggered_by=triggered_by,
            actor_id=actor_id,
            correlation_id=correlation_id,
        )
    )


@celery_app.task(name="app.tasks.ingestion_tasks.sync_all_sources")
def sync_all_sources() -> list[str]:
    """Tarea programada (beat): sincroniza todas las fuentes habilitadas."""
    from app.services.ingestion_runner import sincronizar_todas

    return asyncio.run(sincronizar_todas(triggered_by="scheduled"))
