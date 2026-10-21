"""Variables para la regresión del conteo semanal de sismos (decisión D2).

Las semanas empiezan el lunes 00:00 UTC. Cada fila de la matriz usa solo
información **anterior** a la semana que se estima (rezagos y media móvil), para
no filtrar el futuro en el entrenamiento.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

#: Rezagos (en semanas) y ventana de la media móvil.
REZAGOS = (1, 2, 4)
VENTANA_MEDIA = 12
NOMBRES = [f"conteo_semana_menos_{r}" for r in REZAGOS] + [f"media_ultimas_{VENTANA_MEDIA}_semanas"]


def inicio_semana(momento: datetime) -> datetime:
    dia = momento.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return dia - timedelta(days=dia.weekday())


def conteos_semanales(
    fechas: list[datetime], inicio: datetime, fin: datetime
) -> tuple[list[datetime], list[int]]:
    """Semanas completas del periodo (incluidas las que no tienen eventos) y su conteo."""
    primera = inicio_semana(inicio)
    if primera < inicio.astimezone(timezone.utc):
        primera += timedelta(days=7)  # la semana parcial inicial no cuenta completa
    semanas: list[datetime] = []
    actual = primera
    while actual + timedelta(days=7) <= fin.astimezone(timezone.utc) + timedelta(microseconds=1):
        semanas.append(actual)
        actual += timedelta(days=7)
    indice = {s: i for i, s in enumerate(semanas)}
    conteos = [0] * len(semanas)
    for f in fechas:
        i = indice.get(inicio_semana(f))
        if i is not None:
            conteos[i] += 1
    return semanas, conteos


def matriz(conteos: list[int]) -> tuple[list[list[float]], list[int], int]:
    """Filas de variables, objetivo y el índice de la primera semana con historia suficiente."""
    desde = max(max(REZAGOS), VENTANA_MEDIA)
    filas: list[list[float]] = []
    objetivo: list[int] = []
    for i in range(desde, len(conteos)):
        rezagos = [float(conteos[i - r]) for r in REZAGOS]
        media = sum(conteos[i - VENTANA_MEDIA:i]) / VENTANA_MEDIA
        filas.append(rezagos + [media])
        objetivo.append(conteos[i])
    return filas, objetivo, desde


__all__ = ["REZAGOS", "VENTANA_MEDIA", "NOMBRES", "inicio_semana", "conteos_semanales", "matriz"]
