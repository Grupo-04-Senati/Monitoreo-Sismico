"""Estado del conector de una fuente a partir de sus ejecuciones (sin base de datos).

Registros inválidos descartados ("con errores") no son una caída de la fuente: solo
cuentan si es la última ejecución. Una ejecución fallida reciente sí degrada.

    pytest tests/api -q
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.db.models import RunStatus
from app.services.sources import calcular_resumen, serializar_run

T0 = datetime(2026, 10, 22, 6, 0, tzinfo=timezone.utc)


def _runs(*estados: RunStatus) -> list[SimpleNamespace]:
    """Ejecuciones de la más reciente a la más antigua, como las entrega `listar_runs`."""
    return [
        SimpleNamespace(
            status=e, latency_ms=100, records_inserted=0, records_updated=0, duplicates_skipped=0,
            started_at=T0 - timedelta(minutes=15 * i), finished_at=T0 - timedelta(minutes=15 * i),
        )
        for i, e in enumerate(estados)
    ]


def test_registros_invalidos_antiguos_no_degradan():
    r = calcular_resumen(_runs(RunStatus.CORRECTA, RunStatus.CON_ERRORES))
    assert r.estado_conector == "operativo"


def test_la_ultima_con_registros_invalidos_degrada():
    r = calcular_resumen(_runs(RunStatus.CON_ERRORES, RunStatus.CORRECTA))
    assert r.estado_conector == "degradado"
    assert "inválidos" in r.estado_conector_detalle


def test_un_fallo_reciente_degrada_y_si_es_el_ultimo_sin_conexion():
    assert calcular_resumen(_runs(RunStatus.CORRECTA, RunStatus.FALLIDA)).estado_conector == "degradado"
    assert calcular_resumen(_runs(RunStatus.FALLIDA, RunStatus.CORRECTA)).estado_conector == "sin_conexion"


def test_sin_ejecuciones():
    assert calcular_resumen([]).estado_conector == "sin_datos"


def test_suma_los_eventos_corregidos_por_la_fuente():
    runs = _runs(RunStatus.CORRECTA, RunStatus.CORRECTA, RunStatus.CON_ERRORES)
    runs[0].records_updated, runs[2].records_updated = 3, 2
    assert calcular_resumen(runs).registros_corregidos == 5


def test_la_api_entrega_los_corregidos_de_cada_ejecucion():
    run = _runs(RunStatus.CORRECTA)[0]
    for k, v in {"id": "r1", "source_id": "s1", "triggered_by": "manual", "duration_ms": 10, "http_status": 200,
                 "records_read": 11, "attempts": 1, "error_summary": None, "correlation_id": None}.items():
        setattr(run, k, v)
    run.records_updated = 6
    assert serializar_run(run).records_updated == 6
