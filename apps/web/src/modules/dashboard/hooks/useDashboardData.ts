import { useCallback, useEffect, useState } from "react";
import type { SeismicEvent } from "@/types";
import {
  cargarEventos,
  cargarFuentes,
  cargarResumen,
  contarReportes,
  contarUsuarios,
  type FuenteResumen,
  type ResumenDashboard,
} from "../services/dashboard.service";

/* ════════════════════════════════════════════════════════════════
   Carga los datos reales del Dashboard (resumen, catálogo, fuentes,
   usuarios y reportes). Cada bloque falla de forma independiente: lo que no
   llega queda en `null` y la UI lo muestra como "—".
   ════════════════════════════════════════════════════════════════ */

export interface DashboardData {
  resumen: ResumenDashboard | null;
  eventos: SeismicEvent[] | null;
  fuente: FuenteResumen | null;
  usuarios: number | null;
  reportes: number | null;
}

export interface DashboardDataState {
  data: DashboardData;
  cargando: boolean;
  error: boolean;
  recargar: () => void;
}

const VACIO: DashboardData = { resumen: null, eventos: null, fuente: null, usuarios: null, reportes: null };

export function useDashboardData(): DashboardDataState {
  const [data, setData] = useState<DashboardData>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);

    const seguro = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    Promise.all([
      seguro(cargarResumen()),
      seguro(cargarEventos()),
      seguro(cargarFuentes()),
      seguro(contarUsuarios()),
      seguro(contarReportes()),
    ]).then(([resumen, eventos, fuente, usuarios, reportes]) => {
      if (!vivo) return;
      setData({ resumen, eventos, fuente, usuarios, reportes });
      setError(eventos === null);
      setCargando(false);
    });

    return () => {
      vivo = false;
    };
  }, [nonce]);

  const recargar = useCallback(() => setNonce((n) => n + 1), []);
  return { data, cargando, error, recargar };
}
