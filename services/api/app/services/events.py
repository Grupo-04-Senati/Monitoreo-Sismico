"""Consultas y serialización del módulo "Eventos sísmicos" (6.2).

El catálogo de eventos observados se lee de `seismic_events`. La fuente se
resuelve desde `data_sources` para exponer el proveedor y su URL. Toda la lectura
está disponible para **todos los roles**; la exportación vive en Reportes.
"""

from __future__ import annotations

import unicodedata
from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import DataSource, SeismicEvent
from app.schemas.eventos import (
    EventFeature,
    EventFeatureProperties,
    EventGeoJSONOut,
    EventListOut,
    EventOut,
    EventPointGeometry,
)

#: Nombre mostrado cuando aún no hay proveedor real configurado (nunca inventado).
SOURCE_FALLBACK = "—"

#: Tope de features del GeoJSON para no devolver respuestas desmedidas.
LIMITE_GEOJSON = 5000

#: Tipos de magnitud admitidos por el filtro `mag_type` (más `none` = sin tipo).
TIPOS_MAGNITUD = ("Mw", "ML", "mb")

#: Columnas de orden admitidas (se aceptan alias en español del frontend).
_SORT_MAP: dict[str, object] = {
    "occurred_at": SeismicEvent.occurred_at,
    "fecha": SeismicEvent.occurred_at,
    "magnitude": SeismicEvent.magnitude,
    "magnitud": SeismicEvent.magnitude,
    "depth_km": SeismicEvent.depth_km,
    "profundidad": SeismicEvent.depth_km,
    "region": SeismicEvent.region,
    "locality": SeismicEvent.locality,
    "localidad": SeismicEvent.locality,
    "review_status": SeismicEvent.review_status,
    "estado": SeismicEvent.review_status,
    "id": SeismicEvent.id,
    "latitude": SeismicEvent.latitude,
    "latitud": SeismicEvent.latitude,
    "longitude": SeismicEvent.longitude,
    "longitud": SeismicEvent.longitude,
}


def _slug(texto: str) -> str:
    """Normaliza a slug (sin acentos, minúsculas, `_` como separador)."""
    base = unicodedata.normalize("NFD", texto)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn").lower()
    salida: list[str] = []
    separador = False
    for c in base:
        if c.isalnum():
            salida.append(c)
            separador = False
        elif not separador:
            salida.append("_")
            separador = True
    return "".join(salida).strip("_")


def _a_fecha(valor: str | None, *, fin: bool) -> datetime | None:
    """Acepta `YYYY-MM-DD` o ISO completo (con o sin zona) y devuelve UTC."""
    if not valor:
        return None
    texto = valor.strip()
    try:
        if len(texto) == 10:
            fecha = datetime.fromisoformat(texto)
            if fin:
                fecha = fecha.replace(hour=23, minute=59, second=59, microsecond=999999)
            return fecha.replace(tzinfo=timezone.utc)
        momento = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(timezone.utc)


def _orden(sort: str | None) -> tuple[object, bool]:
    """Interpreta `sort` (`-campo` = descendente). Devuelve (columna, asc)."""
    texto = (sort or "-occurred_at").strip()
    desc = texto.startswith("-")
    campo = texto[1:] if desc else texto
    columna = _SORT_MAP.get(campo, SeismicEvent.occurred_at)
    return columna, not desc


async def _region_name(db: AsyncSession, region: str) -> str | None:
    """Traduce un slug de región al nombre almacenado (p. ej. `lima` → `Lima`)."""
    objetivo = _slug(region)
    nombres = (await db.execute(select(SeismicEvent.region).distinct())).scalars().all()
    for nombre in nombres:
        if nombre and _slug(nombre) == objetivo:
            return nombre
    return None


def serializar_evento(evento: SeismicEvent, source: DataSource | None) -> EventOut:
    return EventOut(
        id=evento.id,
        external_id=evento.external_id,
        occurred_at=evento.occurred_at,
        latitude=evento.latitude,
        longitude=evento.longitude,
        depth_km=evento.depth_km,
        magnitude=evento.magnitude,
        magnitude_type=evento.magnitude_type,
        region=evento.region,
        locality=evento.locality,
        review_status=evento.review_status,
        source_id=evento.source_id,
        provider=source.name if source is not None else SOURCE_FALLBACK,
        source_url=evento.source_url or (source.url_api if source is not None else None),
        received_at=evento.received_at or evento.created_at,
        origin_hash=evento.origin_hash,
    )


async def _fuentes(db: AsyncSession, ids: set[str]) -> dict[str, DataSource]:
    if not ids:
        return {}
    filas = (await db.execute(select(DataSource).where(DataSource.id.in_(ids)))).scalars().all()
    return {f.id: f for f in filas}


def _nombre_catalogo(fuentes: dict[str, DataSource], eventos: list[SeismicEvent]) -> str:
    nombres = {fuentes[e.source_id].name for e in eventos if e.source_id in fuentes}
    if len(nombres) == 1:
        return next(iter(nombres))
    if len(nombres) > 1:
        return "Varias fuentes"
    return SOURCE_FALLBACK


async def _condiciones(
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
) -> list[ColumnElement[bool]]:
    """Filtros comunes al listado y al GeoJSON (fechas, magnitud, región…)."""
    condiciones: list[ColumnElement[bool]] = []

    inicio = _a_fecha(desde, fin=False)
    if inicio is not None:
        condiciones.append(SeismicEvent.occurred_at >= inicio)
    fin = _a_fecha(hasta, fin=True)
    if fin is not None:
        condiciones.append(SeismicEvent.occurred_at <= fin)

    if mag_min is not None:
        condiciones.append(SeismicEvent.magnitude >= mag_min)
    if mag_max is not None:
        condiciones.append(SeismicEvent.magnitude <= mag_max)
    if depth_min is not None:
        condiciones.append(SeismicEvent.depth_km >= depth_min)
    if depth_max is not None:
        condiciones.append(SeismicEvent.depth_km <= depth_max)

    if mag_type == "none":
        condiciones.append(SeismicEvent.magnitude_type.is_(None))
    elif mag_type:
        condiciones.append(SeismicEvent.magnitude_type == mag_type)

    if region:
        nombre = await _region_name(db, region)
        condiciones.append(SeismicEvent.region == (nombre or region))

    if review_status:
        condiciones.append(SeismicEvent.review_status == review_status)

    if q:
        patron = f"%{q.strip().lower()}%"
        condiciones.append(
            or_(
                func.lower(func.coalesce(SeismicEvent.locality, "")).like(patron),
                func.lower(SeismicEvent.external_id).like(patron),
                func.lower(SeismicEvent.id).like(patron),
            )
        )

    return condiciones


async def listar_eventos(
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
    sort: str | None,
    page: int,
    page_size: int,
) -> EventListOut:
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

    columna, ascendente = _orden(sort)
    orden = columna.asc() if ascendente else columna.desc()
    desempate = (
        SeismicEvent.id.desc()
        if columna is SeismicEvent.occurred_at
        else SeismicEvent.occurred_at.desc()
    )
    stmt = (
        select(SeismicEvent)
        .where(*condiciones)
        .order_by(orden, desempate)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    eventos = list((await db.execute(stmt)).scalars().all())

    fuentes = await _fuentes(db, {e.source_id for e in eventos})
    return EventListOut(
        items=[serializar_evento(e, fuentes.get(e.source_id)) for e in eventos],
        total=total,
        page=page,
        page_size=page_size,
        source=_nombre_catalogo(fuentes, eventos),
        generated_at=clock_now(),
    )


async def obtener_evento(db: AsyncSession, event_id: str) -> EventOut | None:
    evento = (
        await db.execute(select(SeismicEvent).where(SeismicEvent.id == event_id))
    ).scalar_one_or_none()
    if evento is None:
        return None
    source = (
        await db.execute(select(DataSource).where(DataSource.id == evento.source_id))
    ).scalar_one_or_none()
    return serializar_evento(evento, source)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en km entre dos puntos (fórmula del semiverseno)."""
    radio = 6371.0088
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * radio * asin(sqrt(a))


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    """Interpreta `min_lon,min_lat,max_lon,max_lat` (orden del estándar GeoJSON)."""
    if not bbox:
        return None
    partes = bbox.split(",")
    if len(partes) != 4:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = (float(p) for p in partes)
    except ValueError:
        return None
    if min_lon > max_lon or min_lat > max_lat:
        return None
    return min_lon, min_lat, max_lon, max_lat


def serializar_feature(evento: SeismicEvent, source: DataSource | None) -> EventFeature:
    return EventFeature(
        geometry=EventPointGeometry(coordinates=(evento.longitude, evento.latitude)),
        properties=EventFeatureProperties(
            id=evento.id,
            magnitude=evento.magnitude,
            magnitude_type=evento.magnitude_type,
            depth_km=evento.depth_km,
            region=evento.region,
            occurred_at=evento.occurred_at,
            source=source.name if source is not None else SOURCE_FALLBACK,
        ),
    )


async def listar_eventos_geojson(
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
    lat: float | None,
    lon: float | None,
    radius_km: float | None,
    bbox: str | None,
) -> EventGeoJSONOut:
    """FeatureCollection de puntos para el mapa (módulo 6.3).

    Reutiliza los filtros del catálogo y añade `bbox` y un radio (centro
    `lat`/`lon` + `radius_km`). El radio se prefiltra por caja en SQL y se ajusta
    con la distancia exacta en memoria.
    """
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

    caja = _parse_bbox(bbox)
    if caja is not None:
        min_lon, min_lat, max_lon, max_lat = caja
        condiciones.append(SeismicEvent.longitude >= min_lon)
        condiciones.append(SeismicEvent.longitude <= max_lon)
        condiciones.append(SeismicEvent.latitude >= min_lat)
        condiciones.append(SeismicEvent.latitude <= max_lat)

    radio_activo = lat is not None and lon is not None and radius_km is not None and radius_km > 0
    if radio_activo:
        d_lat = radius_km / 111.0
        d_lon = radius_km / (111.0 * max(0.05, cos(radians(lat))))
        condiciones.append(SeismicEvent.latitude.between(lat - d_lat, lat + d_lat))
        condiciones.append(SeismicEvent.longitude.between(lon - d_lon, lon + d_lon))

    stmt = (
        select(SeismicEvent)
        .where(*condiciones)
        .order_by(SeismicEvent.occurred_at.desc(), SeismicEvent.id.desc())
        .limit(LIMITE_GEOJSON)
    )
    filas = list((await db.execute(stmt)).scalars().all())

    if radio_activo:
        filas = [e for e in filas if _haversine_km(lat, lon, e.latitude, e.longitude) <= radius_km]

    fuentes = await _fuentes(db, {e.source_id for e in filas})
    return EventGeoJSONOut(
        features=[serializar_feature(e, fuentes.get(e.source_id)) for e in filas],
        count=len(filas),
        source=_nombre_catalogo(fuentes, filas),
        generated_at=clock_now(),
    )


#: Columnas del catálogo compacto, en el orden de cada fila. Son los mismos
#: campos de `EventOut` que usa el frontend (sin `source_id` ni `provider`).
COLUMNAS_COMPACTAS = (
    "id",
    "external_id",
    "occurred_at",
    "latitude",
    "longitude",
    "depth_km",
    "magnitude",
    "magnitude_type",
    "region",
    "locality",
    "review_status",
    "source_url",
    "received_at",
    "origin_hash",
)


def _iso(momento: datetime | None) -> str | None:
    """Mismo texto que Pydantic produce para `EventOut` (UTC con sufijo `Z`)."""
    if momento is None:
        return None
    return momento.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def listar_eventos_compacto(
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
    """Todos los eventos que cumplen los filtros, en filas compactas (sin paginar).

    Para las pantallas que filtran y agregan en el navegador sobre el catálogo
    completo (Dashboard, Mapa, Análisis, Eventos). Mismos valores que
    `serializar_evento`, pero leyendo solo las columnas necesarias y sin construir
    un objeto por evento: con ~7 600 eventos la respuesta pasa de ~1 s a ~0,2 s.
    """
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
    e = SeismicEvent
    stmt = (
        select(
            e.id,
            e.external_id,
            e.occurred_at,
            e.latitude,
            e.longitude,
            e.depth_km,
            e.magnitude,
            e.magnitude_type,
            e.region,
            e.locality,
            e.review_status,
            # Igual que `serializar_evento`: enlace del evento o, si falta, el de la fuente.
            func.coalesce(e.source_url, DataSource.url_api),
            func.coalesce(e.received_at, e.created_at),
            e.origin_hash,
            DataSource.name,
        )
        .outerjoin(DataSource, DataSource.id == e.source_id)
        .where(*condiciones)
        .order_by(e.occurred_at.desc(), e.id.desc())
    )
    filas = (await db.execute(stmt)).all()
    nombres = {f[14] for f in filas if f[14]}
    return {
        "columnas": list(COLUMNAS_COMPACTAS),
        "filas": [
            [f[0], f[1], _iso(f[2]), f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11], _iso(f[12]), f[13]]
            for f in filas
        ],
        "total": len(filas),
        "source": next(iter(nombres)) if len(nombres) == 1 else ("Varias fuentes" if nombres else SOURCE_FALLBACK),
        "generated_at": _iso(clock_now()),
    }


__all__ = [
    "COLUMNAS_COMPACTAS",
    "listar_eventos_compacto",
    "SOURCE_FALLBACK",
    "TIPOS_MAGNITUD",
    "LIMITE_GEOJSON",
    "serializar_evento",
    "listar_eventos",
    "obtener_evento",
    "listar_eventos_geojson",
]
