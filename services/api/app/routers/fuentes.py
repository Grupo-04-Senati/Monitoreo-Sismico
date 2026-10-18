"""Endpoints del módulo "Fuentes de datos" (6.10).

- Lectura (fuente, ejecuciones, calidad, registro): Administrador, Analista y Auditor.
- Escritura (sincronizar ahora, configurar): solo Administrador, y queda auditada.

La credencial es siempre una **referencia** (`config_ref`); su valor nunca se
almacena, se devuelve ni se registra en logs.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission, require_role
from app.db.database import get_db
from app.db.models import DataSource, User
from app.schemas.fuentes import (
    LogsPageOut,
    QualityOut,
    RunsPageOut,
    SourceConfigIn,
    SourceDetailOut,
    SourceListOut,
    SourceOut,
    SyncAcceptedOut,
)
from app.services.audit import registrar_auditoria
from app.services.ingestion_runner import (
    COOLDOWN_SEG,
    esta_en_cooldown,
    ejecutar_sincronizacion,
    iniciar_ejecucion,
    obtener_fuente,
)
from app.services.sources import (
    calcular_calidad,
    calcular_por_hora,
    calcular_resumen,
    listar_runs,
    pagina_logs,
    pagina_runs,
    serializar_fuente,
)

router = APIRouter()

_VER = Depends(require_permission("fuentes"))
_ADMIN = Depends(require_role("admin"))


async def _fuente_o_404(db: AsyncSession, id_o_key: str) -> DataSource:
    source = await obtener_fuente(db, id_o_key)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuente no encontrada")
    return source


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("", response_model=SourceListOut)
async def listar_fuentes(
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> SourceListOut:
    fuentes = list((await db.execute(select(DataSource).order_by(DataSource.created_at))).scalars().all())
    return SourceListOut(items=[serializar_fuente(f) for f in fuentes], total=len(fuentes))


@router.get("/{source_id}", response_model=SourceDetailOut)
async def detalle_fuente(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> SourceDetailOut:
    source = await _fuente_o_404(db, source_id)
    runs = await listar_runs(db, source.id)
    return SourceDetailOut(
        source=serializar_fuente(source),
        summary=calcular_resumen(runs),
        config=serializar_fuente(source),
        por_hora=calcular_por_hora(runs),
    )


@router.get("/{source_id}/runs", response_model=RunsPageOut)
async def listar_ejecuciones(
    source_id: str,
    estado: str | None = Query(default=None),
    periodo: str | None = Query(default=None),
    q: str | None = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> RunsPageOut:
    source = await _fuente_o_404(db, source_id)
    return await pagina_runs(
        db, source.id, estado=estado, periodo=periodo, q=q, pagina=pagina, tamano=tamano
    )


@router.get("/{source_id}/quality", response_model=QualityOut)
async def calidad_fuente(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> QualityOut:
    source = await _fuente_o_404(db, source_id)
    return await calcular_calidad(db, source.id)


@router.get("/{source_id}/logs", response_model=LogsPageOut)
async def registro_fuente(
    source_id: str,
    nivel: str | None = Query(default=None),
    texto: str | None = Query(default=None),
    periodo: str | None = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> LogsPageOut:
    source = await _fuente_o_404(db, source_id)
    return await pagina_logs(
        db, source.id, nivel=nivel, texto=texto, periodo=periodo, pagina=pagina, tamano=tamano
    )


@router.post("/{source_id}/sync", response_model=SyncAcceptedOut, status_code=status.HTTP_202_ACCEPTED)
async def sincronizar_fuente(
    source_id: str,
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    actor: User = _ADMIN,
) -> SyncAcceptedOut:
    source = await _fuente_o_404(db, source_id)

    if await esta_en_cooldown(db, source.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya hay una sincronización en curso. Espere {COOLDOWN_SEG} s e inténtelo de nuevo.",
        )

    correlation_id = _correlacion(request)
    run = await iniciar_ejecucion(
        db,
        source,
        triggered_by="manual",
        actor_id=actor.id,
        correlation_id=correlation_id,
    )

    registrar_auditoria(
        actor_id=actor.id,
        action="fuente_sincronizar",
        entity_type="data_source",
        entity_id=source.id,
        after={"run_id": run.id, "triggered_by": "manual"},
        correlation_id=correlation_id,
    )

    # Corre en segundo plano: Celery si está disponible; si no, BackgroundTasks.
    despachado = False
    try:
        from app.tasks.ingestion_tasks import sync_data_source

        sync_data_source.delay(source.id, run.id, "manual", actor.id, correlation_id)
        despachado = True
    except Exception:  # noqa: BLE001 - el broker puede no estar disponible
        despachado = False

    if not despachado:
        background.add_task(
            ejecutar_sincronizacion,
            source.id,
            run_id=run.id,
            triggered_by="manual",
            actor_id=actor.id,
            correlation_id=correlation_id,
        )

    return SyncAcceptedOut(
        run_id=run.id,
        status=run.status,
        triggered_by="manual",
        correlation_id=correlation_id,
        detalle="Sincronización aceptada; se ejecuta en segundo plano y queda registrada en Auditoría.",
    )


@router.put("/{source_id}/config", response_model=SourceOut)
async def configurar_fuente(
    source_id: str,
    payload: SourceConfigIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = _ADMIN,
) -> SourceOut:
    source = await _fuente_o_404(db, source_id)
    antes = serializar_fuente(source).model_dump()

    cambios = payload.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(source, campo, valor)
    await db.commit()
    await db.refresh(source)

    registrar_auditoria(
        actor_id=actor.id,
        action="fuente_configurada",
        entity_type="data_source",
        entity_id=source.id,
        before=antes,
        after=serializar_fuente(source).model_dump(),
        correlation_id=_correlacion(request),
    )
    return serializar_fuente(source)
