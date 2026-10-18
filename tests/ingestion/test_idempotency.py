"""Pruebas del motor de ingesta (idempotencia, validación y reintentos).

Criterio de aceptación: **repetir la sincronización no crea eventos duplicados**.
Se prueba el motor con un conector fijo en memoria y un repositorio en memoria.

Ejecución (desde la raíz del repo, con pytest instalado):

    pytest tests/ingestion -q
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Permite importar el paquete de ingesta sin empaquetarlo.
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "services"))

from ingestion.connectors.base import ConnectorError, RawRecord  # noqa: E402
from ingestion.engine import run_sync  # noqa: E402
from ingestion.models import NormalizedEvent  # noqa: E402
from ingestion.normalizers.igp import IgpNormalizer  # noqa: E402
from ingestion.validation import validar  # noqa: E402

_BASE = datetime(2026, 10, 17, 8, 0, tzinfo=timezone.utc)


def _payload(i: int) -> dict:
    return {
        "external_id": f"TEST-{i}",
        "occurred_at": (_BASE + timedelta(minutes=i)).isoformat(),
        "latitude": -12.0 - i * 0.1,
        "longitude": -77.0 - i * 0.1,
        "depth_km": 10.0 + i,
        "magnitude": 4.0 + i * 0.1,
        "magnitude_type": "Mw",
        "region": "Lima",
        "locality": f"Zona {i}",
        "review_status": "observado",
    }


class ConectorFijo:
    """Conector de prueba: entrega un conjunto fijo de registros."""

    nombre = "fijo"
    intervalo_min = 15

    def __init__(self, *, fallar: bool = False, n: int = 3) -> None:
        self.fallar = fallar
        self.n = n

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        if self.fallar:
            raise ConnectorError("fallo simulado")
        return [RawRecord(external_id=f"TEST-{i}", payload=_payload(i)) for i in range(self.n)]


class RepositorioMemoria:
    """Imita la unicidad `(source_id, external_id)` de la base de datos."""

    def __init__(self) -> None:
        self.vistos: set[str] = set()

    async def upsert(self, event: NormalizedEvent) -> bool:
        if event.external_id in self.vistos:
            return False
        self.vistos.add(event.external_id)
        return True


def test_validacion_rechaza_valores_invalidos() -> None:
    assert validar(latitude=-12.0, longitude=-77.0, magnitude=4.2) is None
    assert validar(latitude=99.0, longitude=-77.0, magnitude=4.2) is not None
    assert validar(latitude=-12.0, longitude=-77.0, magnitude=None) is not None
    assert validar(latitude=-12.0, longitude=-77.0, magnitude=4.2, depth_km=-3) is not None


def test_sincronizar_dos_veces_no_duplica() -> None:
    async def correr():
        since = _BASE - timedelta(hours=1)
        repo = RepositorioMemoria()
        normalizer = IgpNormalizer("igp")
        primera = await run_sync(
            connector=ConectorFijo(), normalizer=normalizer, repository=repo, since=since
        )
        segunda = await run_sync(
            connector=ConectorFijo(), normalizer=normalizer, repository=repo, since=since
        )
        return primera, segunda, repo

    primera, segunda, repo = asyncio.run(correr())

    assert primera.insertados > 0, "la primera pasada debe insertar eventos"
    assert segunda.insertados == 0, "la segunda pasada no debe insertar nada"
    assert segunda.duplicados == primera.insertados
    assert len(repo.vistos) == primera.insertados


def test_ejecucion_fallida_tras_agotar_reintentos() -> None:
    async def correr():
        repo = RepositorioMemoria()
        return await run_sync(
            connector=ConectorFijo(fallar=True),
            normalizer=IgpNormalizer("igp"),
            repository=repo,
            since=None,
            retries=1,
            sleep=_noop,
        )

    report = asyncio.run(correr())
    assert report.estado == "fallida"
    assert report.intentos == 2
    assert report.error


async def _noop(_segundos: float) -> None:
    return None
