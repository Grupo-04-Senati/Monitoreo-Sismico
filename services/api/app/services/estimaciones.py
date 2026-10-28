"""Estimaciones experimentales (PDF §6.7 y §7).

Solo un modelo **aprobado** de conteo semanal genera estimaciones. Se estima la
semana en curso (lunes a lunes, UTC) con las semanas completas anteriores del
catálogo actual, contadas con **las mismas reglas de limpieza** del dataset con
que se entrenó el modelo. El intervalo sale de los errores reales del modelo en
su partición de prueba (`ml.inference.conteo_semanal`).

Una estimación nace "en revisión"; solo un Administrador la publica o la retira.
Nunca se envía como alerta y siempre lleva modelo, versión, fecha y advertencia.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta

import joblib
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import (
    Dataset,
    EstimateStatus,
    IngestionRun,
    MLExperiment,
    ModelRegistry,
    RiskEstimate,
    SeismicEvent,
    User,
)
from app.services import configuracion
from app.services.audit import registrar_auditoria
from app.services.calidad_datos import FilaEvento, Reglas, preparar
from app.services import zona_dataset
from app.services.ml_bridge import carpeta_artefactos, conteos_semanales, inferencia_conteo, inicio_semana

DISCLAIMER = (
    "Estimación experimental generada por un modelo estadístico. No predice sismos individuales "
    "(cuándo, dónde ni de qué magnitud), no es una alerta oficial y no sustituye la información "
    "del IGP ni de INDECI."
)
METRICA = "sismos_por_semana"
#: Valor por defecto; el vigente es el parámetro `estimaciones_horas_datos_recientes`.
HORAS_DATOS_RECIENTES = 48


def _resumen_reglas(dataset: Dataset) -> str:
    r = dataset.cleaning_rules or {}
    partes = []
    if r.get("magnitud_minima") is not None:
        partes.append(f"M ≥ {r['magnitud_minima']}")
    if r.get("tipos_magnitud"):
        partes.append("tipos " + "/".join(r["tipos_magnitud"]))
    if r.get("solo_revisados"):
        partes.append("solo revisados")
    return ", ".join(partes) or "sin filtro de magnitud"


async def _modelo_y_contexto(db: AsyncSession, model_id: str) -> tuple[ModelRegistry, MLExperiment, Dataset]:
    modelo = await db.get(ModelRegistry, model_id)
    if modelo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")
    if modelo.status != "aprobado":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo un modelo aprobado genera estimaciones.")
    experimento = await db.get(MLExperiment, modelo.experiment_id)
    if experimento is None or experimento.task_type != "conteo_semanal":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo los modelos de conteo semanal generan estimaciones (la regresión lineal es didáctica).",
        )
    dataset = await db.get(Dataset, experimento.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El dataset del modelo no existe.")
    return modelo, experimento, dataset


async def conteos_recientes(db: AsyncSession, dataset: Dataset, inicio, fin_exclusivo) -> tuple[list, list[int]]:
    """Sismos por semana entre `inicio` y `fin_exclusivo`, contados como en el entrenamiento:
    misma fuente, misma zona (D32) y mismas reglas de limpieza que el dataset del modelo."""
    fin = fin_exclusivo - timedelta(microseconds=1)
    consulta = select(SeismicEvent).where(SeismicEvent.occurred_at >= inicio, SeismicEvent.occurred_at < fin_exclusivo)
    if dataset.source_id:
        consulta = consulta.where(SeismicEvent.source_id == dataset.source_id)
    eventos = (await db.execute(consulta)).scalars().all()
    filas = [
        FilaEvento(
            id=e.id, occurred_at=e.occurred_at, latitude=e.latitude, longitude=e.longitude, depth_km=e.depth_km,
            magnitude=e.magnitude, magnitude_type=e.magnitude_type, review_status=e.review_status,
            origin_hash=e.origin_hash, region=e.region,
        )
        for e in eventos
    ]
    filas, _fuera = zona_dataset.filtrar(filas, (dataset.query_spec or {}).get("zona"))
    conservados = {i for i, _ in preparar(filas, Reglas(**dataset.cleaning_rules), periodo=(inicio, fin)).filas}
    return conteos_semanales([f.occurred_at for f in filas if f.id in conservados], inicio, fin)


async def crear(
    db: AsyncSession, actor: User, model_id: str, *, correlation_id: str | None = None
) -> RiskEstimate:
    modelo, experimento, dataset = await _modelo_y_contexto(db, model_id)

    ahora = clock_now()
    inicio_ventana = inicio_semana(ahora)
    fin_ventana = inicio_ventana + timedelta(days=7)
    inicio_historia = inicio_ventana - timedelta(weeks=inferencia_conteo.SEMANAS_NECESARIAS)

    semanas, conteos = await conteos_recientes(db, dataset, inicio_historia, inicio_ventana)

    ruta = carpeta_artefactos() / experimento.artifact_uri if experimento.artifact_uri else None
    if ruta is None or not ruta.is_file():
        # Sin el archivo (servidor sin disco persistente o volumen perdido): se reentrena
        # igual, con el mismo dataset congelado y la misma semilla (D28).
        from app.services.ml_experimentos import reconstruir_artefacto

        ruta = await reconstruir_artefacto(db, experimento)
    artefacto = await asyncio.to_thread(joblib.load, ruta)
    serie = (experimento.results or {}).get("serie_prueba") or []
    try:
        errores = inferencia_conteo.errores_de_prueba(serie, experimento.algorithm)
        resultado = inferencia_conteo.estimar(artefacto["modelos"][experimento.algorithm], conteos, errores, experimento.algorithm)
    except (inferencia_conteo.ErrorEstimacion, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"No se puede estimar: {exc}") from exc

    advertencias = [
        "La semana estimada aún no termina: compare con lo observado cuando cierre.",
    ]
    ultima = await db.scalar(
        select(func.max(IngestionRun.finished_at)).where(IngestionRun.status.in_(("correcta", "con_errores")))
    )
    horas_recientes = await configuracion.valor(db, "estimaciones_horas_datos_recientes")
    if ultima is None or (ahora - ultima) > timedelta(hours=horas_recientes):
        advertencias.append(
            f"La última sincronización correcta tiene más de {horas_recientes} h: las semanas previas pueden estar incompletas."
        )
    ancho = resultado["superior"] - resultado["inferior"]
    if resultado["valor"] and ancho > 2 * resultado["valor"]:
        advertencias.append("El intervalo es muy ancho frente al valor: la estimación es poco informativa.")

    referencia = next((p.get("referencia_media") for p in serie if "referencia_media" in p), None)
    estimacion = RiskEstimate(
        model_id=modelo.id,
        area_code=f"dataset:{dataset.id}"[:64],
        area_description=(
            f"{zona_dataset.describir((dataset.query_spec or {}).get('zona'))} · dataset {dataset.name} "
            f"v{dataset.version} ({_resumen_reglas(dataset)})"
        )[:255],
        window_start=inicio_ventana,
        window_end=fin_ventana,
        metric_name=METRICA,
        value=resultado["valor"],
        lower_bound=resultado["inferior"],
        upper_bound=resultado["superior"],
        confidence_level=resultado["nivel"],
        method=resultado["metodo"][:160],
        reference_value=referencia,
        inputs={
            "modelo": f"{modelo.name} v{modelo.version}",
            "experimento_id": experimento.id,
            "algoritmo": experimento.algorithm,
            "dataset_id": dataset.id,
            "semanas": [{"inicio": s.date().isoformat(), "conteo": c} for s, c in zip(semanas, conteos)],
            "variables": resultado["variables"],
            "errores_usados": resultado["errores_usados"],
        },
        warnings=advertencias,
        disclaimer=DISCLAIMER,
        calculated_at=ahora,
        status=EstimateStatus.EN_REVISION,
        created_by=actor.id,
    )
    db.add(estimacion)
    await db.commit()
    await db.refresh(estimacion)
    registrar_auditoria(
        actor_id=actor.id,
        action="estimacion_creada",
        entity_type="risk_estimate",
        entity_id=estimacion.id,
        after={"model_id": modelo.id, "valor": estimacion.value, "ventana": inicio_ventana.date().isoformat()},
        correlation_id=correlation_id,
    )
    return estimacion


async def obtener(db: AsyncSession, estimate_id: str) -> RiskEstimate:
    estimacion = await db.get(RiskEstimate, estimate_id)
    if estimacion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Estimación no encontrada")
    return estimacion


async def modelos_de(db: AsyncSession, ids: set[str]) -> dict[str, tuple[ModelRegistry, MLExperiment]]:
    if not ids:
        return {}
    filas = await db.execute(
        select(ModelRegistry, MLExperiment)
        .join(MLExperiment, MLExperiment.id == ModelRegistry.experiment_id)
        .where(ModelRegistry.id.in_(ids))
    )
    return {m.id: (m, e) for m, e in filas.all()}


async def listar(
    db: AsyncSession, *, estado: str | None, page: int, page_size: int
) -> tuple[list[RiskEstimate], int]:
    filtros = [RiskEstimate.status == estado] if estado else []
    total = await db.scalar(select(func.count()).select_from(RiskEstimate).where(*filtros)) or 0
    items = (
        await db.execute(
            select(RiskEstimate)
            .where(*filtros)
            .order_by(RiskEstimate.calculated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return list(items), total


#: Transiciones permitidas del estado de revisión.
_TRANSICIONES = {
    EstimateStatus.PUBLICADA: {EstimateStatus.EN_REVISION},
    EstimateStatus.RETIRADA: {EstimateStatus.EN_REVISION, EstimateStatus.PUBLICADA},
}


async def revisar(
    db: AsyncSession, actor: User, estimate_id: str, nuevo: str, *, correlation_id: str | None = None
) -> RiskEstimate:
    estimacion = await obtener(db, estimate_id)
    if estimacion.status not in _TRANSICIONES[nuevo]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede pasar de «{estimacion.status}» a «{nuevo}».",
        )
    anterior = estimacion.status
    estimacion.status = nuevo
    estimacion.reviewed_by = actor.id
    estimacion.reviewed_at = clock_now()
    await db.commit()
    await db.refresh(estimacion)
    registrar_auditoria(
        actor_id=actor.id,
        action="estimacion_publicada" if nuevo == EstimateStatus.PUBLICADA else "estimacion_retirada",
        entity_type="risk_estimate",
        entity_id=estimacion.id,
        before={"status": anterior},
        after={"status": nuevo},
        correlation_id=correlation_id,
    )
    return estimacion


__all__ = ["DISCLAIMER", "crear", "obtener", "listar", "revisar", "modelos_de"]
