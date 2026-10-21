"""Prueba de carga de la API (PDF Fase 9 y §12): N usuarios simultáneos navegando
Dashboard y Eventos con las mismas llamadas que hace el navegador.

Cada usuario virtual repite, durante `--duracion` segundos, una visita al Dashboard o
a Eventos (al azar), con una pausa de lectura entre visitas. Para que la caché del
servidor no maquille los números, el periodo y la magnitud mínima varían al azar.
Mide p50/p95/p99 por llamada, errores y peticiones por segundo. Termina con código 1
si el p95 global supera `--p95-max-ms` o los errores superan `--errores-max`.

Solo hace lecturas (GET): no modifica datos. Inicia sesión una vez con una cuenta de
prueba (contraseña en la variable CARGA_PASSWORD) y comparte la sesión entre usuarios.

    CARGA_PASSWORD=... python tests/carga/carga.py --url http://127.0.0.1:8020 \\
        --email carga@empresa-ejemplo.pe --usuarios 50 --duracion 60
"""

from __future__ import annotations

import argparse
import asyncio
import os
import random
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import httpx

API = "/api/v1"


class Medidor:
    def __init__(self) -> None:
        self.tiempos: dict[str, list[float]] = defaultdict(list)
        self.errores: dict[str, int] = defaultdict(int)
        self.detalle_errores: dict[str, int] = defaultdict(int)

    def registrar(self, nombre: str, ms: float, ok: bool, motivo: str = "") -> None:
        self.tiempos[nombre].append(ms)
        if not ok:
            self.errores[nombre] += 1
            self.detalle_errores[motivo] += 1


def _p(valores: list[float], q: float) -> float:
    if not valores:
        return 0.0
    orden = sorted(valores)
    return orden[min(len(orden) - 1, int(q * len(orden)))]


async def _get(cliente: httpx.AsyncClient, medidor: Medidor, nombre: str, ruta: str) -> httpx.Response | None:
    inicio = time.perf_counter()
    try:
        r = await cliente.get(ruta)
        medidor.registrar(nombre, (time.perf_counter() - inicio) * 1000, r.status_code < 400, f"HTTP {r.status_code}")
        return r
    except httpx.HTTPError as exc:
        medidor.registrar(nombre, (time.perf_counter() - inicio) * 1000, False, type(exc).__name__)
        return None


def _rango(dias: int) -> str:
    fin = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    ini = fin - timedelta(days=dias)
    return f"from={ini.isoformat().replace('+00:00', 'Z')}&to={fin.isoformat().replace('+00:00', 'Z')}"


async def visita_dashboard(c: httpx.AsyncClient, m: Medidor, fuente: str | None) -> None:
    await asyncio.gather(
        _get(c, m, "auth/me", f"{API}/auth/me"),
        _get(c, m, "meta", f"{API}/meta"),
        _get(c, m, "dashboard/summary", f"{API}/dashboard/summary"),
        _get(c, m, "sources", f"{API}/sources"),
        *(
            [
                _get(c, m, "sources/runs", f"{API}/sources/{fuente}/runs?pagina=1&tamano=100"),
                _get(c, m, "sources/quality", f"{API}/sources/{fuente}/quality"),
            ]
            if fuente
            else []
        ),
        _get(c, m, "events/compact (30 d)", f"{API}/events/compact?{_rango(30)}"),
    )


async def visita_eventos(c: httpx.AsyncClient, m: Medidor) -> None:
    dias = random.choice([30, 90, 365, 365 * 5])
    await asyncio.gather(_get(c, m, "meta", f"{API}/meta"), _get(c, m, "events/compact (periodo)", f"{API}/events/compact?{_rango(dias)}"))
    mag = random.choice(["4.0", "4.5", "5.0", "5.5"])
    await _get(c, m, "events/compact (filtro mag)", f"{API}/events/compact?{_rango(dias)}&mag_min={mag}")
    anio = random.randint(2000, 2025)
    await _get(
        c, m, "events (página filtrada)",
        f"{API}/events?from={anio}-01-01T05:00:00Z&to={anio + 1}-01-01T05:00:00Z&mag_min={mag}&page=1&page_size=50",
    )


async def usuario(cookies: httpx.Cookies, base: str, m: Medidor, fin: float, fuente: str | None, pausa: tuple[float, float]) -> None:
    async with httpx.AsyncClient(base_url=base, cookies=cookies, timeout=30.0) as c:
        # Llegadas repartidas a lo largo de una pausa (nadie entra a la vez que todos).
        await asyncio.sleep(random.uniform(0, max(2.0, pausa[1])))
        while time.perf_counter() < fin:
            if random.random() < 0.5:
                await visita_dashboard(c, m, fuente)
            else:
                await visita_eventos(c, m)
            await asyncio.sleep(random.uniform(*pausa))


async def principal(args: argparse.Namespace) -> int:
    password = os.environ.get("CARGA_PASSWORD")
    if not password:
        sys.exit("Falta CARGA_PASSWORD (contraseña de la cuenta de prueba).")
    urls = [u.strip() for u in args.url.split(",") if u.strip()]
    async with httpx.AsyncClient(base_url=urls[0], timeout=30.0) as c:
        r = await c.post(f"{API}/auth/login", json={"email": args.email, "password": password})
        if r.status_code != 200:
            sys.exit(f"No se pudo iniciar sesión ({r.status_code}): {r.text[:200]}")
        cookies = c.cookies
        fuentes = (await c.get(f"{API}/sources")).json()
        lista = fuentes if isinstance(fuentes, list) else fuentes.get("items", [])
        fuente = lista[0]["id"] if lista else None

    m = Medidor()
    inicio = time.perf_counter()
    fin = inicio + args.duracion
    # Con varias URL (procesos detrás de un balanceador), cada usuario usa una, en rueda.
    await asyncio.gather(
        *(usuario(cookies, urls[i % len(urls)], m, fin, fuente, (args.pausa_min, args.pausa_max)) for i in range(args.usuarios))
    )
    total_s = time.perf_counter() - inicio

    todos = [t for v in m.tiempos.values() for t in v]
    errores = sum(m.errores.values())
    tasa_err = errores / len(todos) if todos else 1.0
    print(f"\n{args.usuarios} usuarios · {len(urls)} proceso(s) · pausa {args.pausa_min:g}-{args.pausa_max:g} s · {total_s:.0f} s · {len(todos)} peticiones · {len(todos) / total_s:.1f} pet/s · errores {errores} ({tasa_err:.2%})")
    print(f"{'llamada':32} {'n':>6} {'p50':>8} {'p95':>8} {'p99':>8} {'máx':>8} {'err':>5}")
    for nombre in sorted(m.tiempos):
        v = m.tiempos[nombre]
        print(f"{nombre:32} {len(v):6d} {statistics.median(v):8.0f} {_p(v, .95):8.0f} {_p(v, .99):8.0f} {max(v):8.0f} {m.errores[nombre]:5d}")
    p95 = _p(todos, .95)
    print(f"{'TOTAL':32} {len(todos):6d} {statistics.median(todos):8.0f} {p95:8.0f} {_p(todos, .99):8.0f} {max(todos):8.0f} {errores:5d}  (ms)")
    if m.detalle_errores:
        print("errores:", dict(m.detalle_errores))

    ok = p95 <= args.p95_max_ms and tasa_err <= args.errores_max
    print(f"\nResultado: {'CUMPLE' if ok else 'NO CUMPLE'} (p95 ≤ {args.p95_max_ms} ms y errores ≤ {args.errores_max:.0%})")
    return 0 if ok else 1


def main() -> None:
    a = argparse.ArgumentParser(description="Prueba de carga de Dashboard y Eventos.")
    a.add_argument("--url", default="http://127.0.0.1:8020", help="una o varias URL separadas por coma")
    a.add_argument("--email", required=True)
    a.add_argument("--usuarios", type=int, default=50)
    a.add_argument("--duracion", type=int, default=60, help="segundos")
    a.add_argument("--pausa-min", type=float, default=1.0, help="pausa de lectura entre visitas (s)")
    a.add_argument("--pausa-max", type=float, default=3.0)
    a.add_argument("--p95-max-ms", type=float, default=1000)
    a.add_argument("--errores-max", type=float, default=0.01)
    sys.exit(asyncio.run(principal(a.parse_args())))


if __name__ == "__main__":
    main()
