"""Cálculos del módulo "Análisis estadístico" en SQL real.

Todo se agrega en la base de datos sobre `seismic_events`, aplicando los mismos
filtros que el listado de eventos (`app.services.events._condiciones`). Las fechas
se agrupan en hora local UTC-5 (America/Lima), igual que el mock del frontend.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import SeismicEvent
from app.services.events import _condiciones

MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

AGRUPACIONES = ("dia", "semana", "mes", "hora")

UNIDAD = {"dia": "Día", "semana": "Semana (inicio)", "mes": "Mes", "hora": "Hora"}


def _etiqueta(clave: str, agrupacion: str) -> str:
    if agrupacion == "mes":
        y, m = clave.split("-")
        return f"{MES[int(m) - 1]} {y[2:]}"
    if agrupacion == "hora":
        return f"{clave.split('T')[1]}h"
    _, m, d = clave.split("-")
    corta = f"{int(d)} {MES[int(m) - 1]}"
    return f"Sem {corta}" if agrupacion == "semana" else corta


def _clave_sql(agrupacion: str):
    local = func.timezone("America/Lima", SeismicEvent.occurred_at)
    if agrupacion == "semana":
        return func.to_char(func.date_trunc("week", local), "YYYY-MM-DD")
    if agrupacion == "mes":
        return func.to_char(local, "YYYY-MM")
    if agrupacion == "hora":
        return func.to_char(local, 'YYYY-MM-DD"T"HH24')
    return func.to_char(local, "YYYY-MM-DD")


async def serie_temporal(
    db: AsyncSession,
    *,
    agrupacion: str,
    desde: str | None,
    hasta: str | None,
    mag_min: float | None,
    mag_max: float | None,
    mag_type: str | None,
    depth_min: float | None,
    depth_max: float | None,
    region: str | None,
    review_status: str | None,
    q: str | None,
) -> dict:
    if agrupacion not in AGRUPACIONES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Agrupación no válida (dia | semana | mes | hora).",
        )

    condiciones = await _condiciones(
        db,
        desde=desde,
        hasta=hasta,
        mag_min=mag_min,
        mag_max=mag_max,
        mag_type=mag_type,
        depth_min=depth_min,
        depth_max=depth_max,
        region=region,
        review_status=review_status,
        q=q,
    )

    clave = _clave_sql(agrupacion)
    consulta = (
        select(clave.label("clave"), func.count().label("valor"))
        .where(*condiciones)
        .group_by(clave)
        .order_by(clave)
    )
    filas = (await db.execute(consulta)).all()

    puntos = [
        {"clave": fila[0], "etiqueta": _etiqueta(fila[0], agrupacion), "valor": int(fila[1])}
        for fila in filas
    ]
    return {
        "agrupacion": agrupacion,
        "unidad": UNIDAD[agrupacion],
        "total": sum(p["valor"] for p in puntos),
        "puntos": puntos,
        "generated_at": clock_now().isoformat(),
    }


async def resumen_estadistico(
    db: AsyncSession,
    *,
    desde: str | None,
    hasta: str | None,
    mag_min: float | None,
    mag_max: float | None,
    mag_type: str | None,
    depth_min: float | None,
    depth_max: float | None,
    region: str | None,
    review_status: str | None,
    q: str | None,
) -> dict:
    condiciones = await _condiciones(
        db,
        desde=desde,
        hasta=hasta,
        mag_min=mag_min,
        mag_max=mag_max,
        mag_type=mag_type,
        depth_min=depth_min,
        depth_max=depth_max,
        region=region,
        review_status=review_status,
        q=q,
    )

    total = int(
        (await db.execute(select(func.count()).select_from(SeismicEvent).where(*condiciones))).scalar_one()
    )
    sin_profundidad = int(
        (
            await db.execute(
                select(func.count())
                .select_from(SeismicEvent)
                .where(*condiciones, SeismicEvent.depth_km.is_(None))
            )
        ).scalar_one()
    )
    sin_tipo = int(
        (
            await db.execute(
                select(func.count())
                .select_from(SeismicEvent)
                .where(*condiciones, SeismicEvent.magnitude_type.is_(None))
            )
        ).scalar_one()
    )

    mag = (
        await db.execute(
            select(
                func.avg(SeismicEvent.magnitude),
                func.min(SeismicEvent.magnitude),
                func.max(SeismicEvent.magnitude),
                func.stddev_samp(SeismicEvent.magnitude),
                func.percentile_cont(0.5).within_group(SeismicEvent.magnitude),
            ).where(*condiciones)
        )
    ).one()

    prof = (
        await db.execute(
            select(
                func.count(SeismicEvent.depth_km),
                func.avg(SeismicEvent.depth_km),
                func.percentile_cont(0.25).within_group(SeismicEvent.depth_km),
                func.percentile_cont(0.5).within_group(SeismicEvent.depth_km),
                func.percentile_cont(0.75).within_group(SeismicEvent.depth_km),
            ).where(*condiciones)
        )
    ).one()

    def _num(v):
        return None if v is None else float(v)

    return {
        "n": total,
        "faltantes": sin_profundidad + sin_tipo,
        "sin_profundidad": sin_profundidad,
        "sin_tipo_magnitud": sin_tipo,
        "magnitud": {
            "media": _num(mag[0]),
            "minima": _num(mag[1]),
            "maxima": _num(mag[2]),
            "desviacion": _num(mag[3]),
            "mediana": _num(mag[4]),
        },
        "profundidad": {
            "n": int(prof[0] or 0),
            "media": _num(prof[1]),
            "p25": _num(prof[2]),
            "mediana": _num(prof[3]),
            "p75": _num(prof[4]),
        },
        "generated_at": clock_now().isoformat(),
    }


__all__ = ["serie_temporal", "resumen_estadistico", "AGRUPACIONES"]
