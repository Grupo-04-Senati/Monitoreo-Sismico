import type { SeismicEvent } from "@/types";
import { filterEvents, periodBounds, periodLabel } from "@/lib/catalogo";
import { dayKeyUTC5, fmtDateTimeUTC5 } from "@/lib/format";
import { SOURCE_NAME } from "@/config/fuente";
import type { EventoSismico } from "@/modules/eventos/types";
import type {
  FiltrosAnalisis,
  KpiInfo,
  PuntoDispersion,
  PuntoGrafico,
  ResultadoAnalisis,
  Tabla,
} from "../types";
import { VARIABLES, resumenFiltros } from "../schemas/analisis.schema";
import {
  cuantil,
  desviacion,
  fmt2,
  maximo,
  media,
  mediana,
  minimo,
  pearson,
  spearman,
} from "../lib/estadistica";

/* ════════════════════════════════════════════════════════════════
   Cálculos del módulo de Análisis estadístico. Todo se deriva del
   catálogo real de eventos (API `/events`), aplicando los filtros del módulo.
   ════════════════════════════════════════════════════════════════ */

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Adapta un evento de la API (`EventoSismico`) al tipo compartido `SeismicEvent`. */
export function desdeCatalogo(e: EventoSismico): SeismicEvent {
  return {
    id: e.id,
    externalId: e.externalId,
    sourceId: "",
    sourceName: SOURCE_NAME,
    occurredAt: e.occurredAtUtc,
    magnitude: e.magnitude,
    magnitudeType: e.magnitudeType,
    depthKm: e.depthKm,
    place: e.locality,
    region: e.region,
    sourceUrl: e.sourceUrl,
    receivedAt: e.receivedAtUtc,
    status: e.reviewStatus === "pendiente_validacion" ? "pending_review" : "observed",
  };
}

/* ── Filtrado ─────────────────────────────────────────── */

export function eventosFiltrados(f: FiltrosAnalisis, catalogo: SeismicEvent[]): SeismicEvent[] {
  const periodoId = f.periodo === "rango" ? "custom" : f.periodo;
  const base = filterEvents(catalogo, {
    periodo: periodoId,
    desde: f.desde,
    hasta: f.hasta,
    zona: f.zona,
  });
  return base.filter(
    (e) =>
      (f.magnitudMin == null || e.magnitude >= f.magnitudMin) &&
      (f.magnitudMax == null || e.magnitude <= f.magnitudMax) &&
      (!f.tipo || (f.tipo === "none" ? !e.magnitudeType : e.magnitudeType === f.tipo)) &&
      (f.profundidadMin == null || (e.depthKm != null && e.depthKm >= f.profundidadMin)) &&
      (f.profundidadMax == null || (e.depthKm != null && e.depthKm <= f.profundidadMax)),
  );
}

/* ── Serie temporal ───────────────────────────────────── */

function diaCorto(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)} ${MES[Number(m) - 1]}`;
}

function claveSerie(iso: string, ag: FiltrosAnalisis["agrupacion"]): string {
  const day = dayKeyUTC5(iso);
  if (ag === "dia") return day;
  if (ag === "mes") return day.slice(0, 7);
  if (ag === "semana") {
    const [y, m, d] = day.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const mon = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7)));
    const mm = String(mon.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(mon.getUTCDate()).padStart(2, "0");
    return `${mon.getUTCFullYear()}-${mm}-${dd}`;
  }
  const d2 = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return `${day}T${String(d2.getUTCHours()).padStart(2, "0")}`;
}

function etiquetaSerie(key: string, ag: FiltrosAnalisis["agrupacion"]): string {
  if (ag === "mes") {
    const [y, m] = key.split("-");
    return `${MES[Number(m) - 1]} ${y.slice(2)}`;
  }
  if (ag === "hora") return `${key.split("T")[1]}h`;
  if (ag === "semana") return `Sem ${diaCorto(key)}`;
  return diaCorto(key);
}

/** Máximo de periodos que se rellenan con 0; por encima solo se muestran los que tienen eventos. */
const MAX_PERIODOS_SERIE = 10_000;

/** Clave del periodo siguiente (hora, día, lunes siguiente o mes siguiente). */
function siguienteClave(key: string, ag: FiltrosAnalisis["agrupacion"]): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  if (ag === "mes") {
    const [y, m] = key.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${dos(m + 1)}`;
  }
  const [dia, hora] = key.split("T");
  const [y, m, d] = dia.split("-").map(Number);
  const n =
    ag === "hora"
      ? new Date(Date.UTC(y, m - 1, d, Number(hora) + 1))
      : new Date(Date.UTC(y, m - 1, d + (ag === "semana" ? 7 : 1)));
  const base = `${n.getUTCFullYear()}-${dos(n.getUTCMonth() + 1)}-${dos(n.getUTCDate())}`;
  return ag === "hora" ? `${base}T${dos(n.getUTCHours())}` : base;
}

/**
 * Serie temporal. Los periodos sin eventos del rango cuentan como 0: omitirlos
 * uniría periodos separados y la media móvil promediaría días no consecutivos.
 */
function calcularSerie(
  eventos: SeismicEvent[],
  ag: FiltrosAnalisis["agrupacion"],
  rango: { start: number; end: number },
): ResultadoAnalisis["serie"] {
  const mapa = new Map<string, SeismicEvent[]>();
  for (const e of eventos) {
    const k = claveSerie(e.occurredAt, ag);
    const arr = mapa.get(k);
    if (arr) arr.push(e);
    else mapa.set(k, [e]);
  }
  const conEventos = [...mapa.keys()].sort((a, b) => a.localeCompare(b));
  // El rango es el del filtro; si no tiene límites, el de los propios eventos.
  const desde = Number.isFinite(rango.start) ? claveSerie(new Date(rango.start).toISOString(), ag) : conEventos[0];
  const hasta = Number.isFinite(rango.end) ? claveSerie(new Date(rango.end - 1).toISOString(), ag) : conEventos[conEventos.length - 1];
  let claves: string[] = [];
  let recortada = false;
  if (desde && hasta) {
    for (let k = desde; k <= hasta; k = siguienteClave(k, ag)) {
      if (claves.length >= MAX_PERIODOS_SERIE) {
        recortada = true;
        break;
      }
      claves.push(k);
    }
  }
  if (recortada) claves = conEventos; // periodo enorme para esta agrupación: no se rellena
  const puntos: PuntoGrafico[] = claves.map((k) => {
    const evs = mapa.get(k) ?? [];
    return { label: etiquetaSerie(k, ag), value: evs.length, eventos: evs };
  });

  let mediaMovil: (number | null)[] = [];
  let nota = "";
  if (recortada) {
    nota = "Periodo demasiado largo para esta agrupación: solo se muestran los periodos con eventos. Use una agrupación mayor.";
  } else if (ag === "dia" && puntos.length >= 7) {
    mediaMovil = puntos.map((_, i) => {
      const desde = Math.max(0, i - 6);
      const ventana = puntos.slice(desde, i + 1);
      return media(ventana.map((p) => p.value));
    });
    nota = "Línea punteada: media móvil de 7 días.";
  }

  const unidad =
    ag === "hora" ? "Hora" : ag === "mes" ? "Mes" : ag === "semana" ? "Semana (inicio)" : "Día";
  return { puntos, mediaMovil, unidad, nota };
}

/* ── Histogramas ──────────────────────────────────────── */

function histogramaMagnitud(eventos: SeismicEvent[], w: number): PuntoGrafico[] {
  const nb = Math.round(4 / w) + 1;
  const puntos: PuntoGrafico[] = Array.from({ length: nb }, (_, i) => {
    const lo = 2 + i * w;
    const ultimo = i === nb - 1;
    return {
      label: ultimo ? "6.0+" : `${lo.toFixed(1)}–${(lo + w - 0.1).toFixed(1)}`,
      value: 0,
      eventos: [] as SeismicEvent[],
    };
  });
  for (const e of eventos) {
    const i = Math.min(nb - 1, Math.max(0, Math.floor((e.magnitude - 2) / w + 1e-9)));
    puntos[i].value++;
    puntos[i].eventos.push(e);
  }
  return puntos;
}

const PROF_EDGES = [0, 25, 50, 100, 150];
const PROF_LABELS = ["0–24 km", "25–49 km", "50–99 km", "100–149 km", "150+ km"];

function histogramaProfundidad(eventos: SeismicEvent[]): {
  puntos: PuntoGrafico[];
  faltantes: number;
} {
  const puntos: PuntoGrafico[] = PROF_LABELS.map((label) => ({ label, value: 0, eventos: [] }));
  let faltantes = 0;
  for (const e of eventos) {
    if (e.depthKm == null || !Number.isFinite(e.depthKm)) {
      faltantes++;
      continue;
    }
    let i = PROF_EDGES.length - 1;
    while (i > 0 && e.depthKm < PROF_EDGES[i]) i--;
    puntos[i].value++;
    puntos[i].eventos.push(e);
  }
  return { puntos, faltantes };
}

/* ── Conteo por región ────────────────────────────────── */

function conteoPorRegion(eventos: SeismicEvent[], top: number): PuntoGrafico[] {
  const mapa = new Map<string, SeismicEvent[]>();
  for (const e of eventos) {
    const arr = mapa.get(e.region);
    if (arr) arr.push(e);
    else mapa.set(e.region, [e]);
  }
  return [...mapa.entries()]
    .map(([label, evs]) => ({ label, value: evs.length, eventos: evs }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"))
    .slice(0, top);
}

/* ── Dispersión y correlación ─────────────────────────── */

function calcularDispersion(f: FiltrosAnalisis, eventos: SeismicEvent[]): ResultadoAnalisis["dispersion"] {
  const fx = VARIABLES[f.x].get;
  const fy = VARIABLES[f.y].get;
  const puntos: PuntoDispersion[] = eventos
    .filter((e) => Number.isFinite(fx(e)) && Number.isFinite(fy(e)))
    .map((e) => ({ x: fx(e), y: fy(e), evento: e }));
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const r = (f.metodo === "spearman" ? spearman : pearson)(xs, ys);
  const nota =
    puntos.length >= 3
      ? `${f.metodo === "spearman" ? "ρ Spearman" : "r Pearson"} = ${fmt2(r)} (n=${puntos.length}). Asociación descriptiva; no implica causalidad.`
      : "Se requieren al menos 3 eventos con ambas variables para calcular la correlación.";

  return {
    puntos,
    xLabel: VARIABLES[f.x].label,
    yLabel: VARIABLES[f.y].label,
    r,
    n: puntos.length,
    nota,
  };
}

/* ── Tablas ───────────────────────────────────────────── */

function tablaResumen(eventos: SeismicEvent[]): Tabla {
  const columnas = [
    { clave: "var", etiqueta: "Variable" },
    { clave: "n", etiqueta: "n", numerica: true },
    { clave: "falta", etiqueta: "Faltantes", numerica: true },
    { clave: "media", etiqueta: "Media", numerica: true },
    { clave: "mediana", etiqueta: "Mediana", numerica: true },
    { clave: "desv", etiqueta: "Desv. est.", numerica: true },
    { clave: "min", etiqueta: "Mín", numerica: true },
    { clave: "p25", etiqueta: "P25", numerica: true },
    { clave: "p75", etiqueta: "P75", numerica: true },
    { clave: "max", etiqueta: "Máx", numerica: true },
  ];
  let faltantes = 0;
  const filas = (Object.keys(VARIABLES) as (keyof typeof VARIABLES)[]).map((k) => {
    const get = VARIABLES[k].get;
    const valores = eventos.map(get).filter((v) => Number.isFinite(v));
    const fal = eventos.length - valores.length;
    faltantes += fal;
    return [
      VARIABLES[k].label,
      valores.length,
      fal,
      fmt2(media(valores)),
      fmt2(mediana(valores)),
      fmt2(desviacion(valores)),
      fmt2(minimo(valores)),
      fmt2(cuantil(valores, 0.25)),
      fmt2(cuantil(valores, 0.75)),
      fmt2(maximo(valores)),
    ];
  });
  return { columnas, filas, total: eventos.length, faltantes };
}

function tablaEventos(eventos: SeismicEvent[]): Tabla {
  const columnas = [
    { clave: "id", etiqueta: "ID" },
    { clave: "fecha", etiqueta: "Fecha (UTC-5)" },
    { clave: "localidad", etiqueta: "Localidad" },
    { clave: "region", etiqueta: "Región" },
    { clave: "magnitud", etiqueta: "Magnitud", numerica: true },
    { clave: "profundidad", etiqueta: "Profundidad", numerica: true },
  ];
  const orden = [...eventos].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const filas = orden.map((e) => [
    e.id,
    fmtDateTimeUTC5(e.occurredAt),
    e.place,
    e.region,
    `${e.magnitude.toFixed(1)} ${e.magnitudeType ?? "—"}`,
    e.depthKm != null ? `${e.depthKm} km` : "—",
  ]);
  return { columnas, filas, total: orden.length, faltantes: 0 };
}

/* ── Indicadores (KPI) ────────────────────────────────── */

function calcularKpis(
  eventos: SeismicEvent[],
  etiquetaPeriodo: string,
  dispersion: ResultadoAnalisis["dispersion"],
  metodo: FiltrosAnalisis["metodo"],
  dias: number,
): { kpis: KpiInfo[]; faltantes: number } {
  const magnitudes = eventos.map((e) => e.magnitude);
  const profundidades = eventos.map((e) => e.depthKm).filter((v): v is number => v != null && Number.isFinite(v));
  const sinProfundidad = eventos.length - profundidades.length;
  const sinTipo = eventos.filter((e) => !e.magnitudeType).length;
  const faltantes = sinProfundidad + sinTipo;

  const kpis: KpiInfo[] = [
    {
      id: "n",
      etiqueta: "Eventos (n)",
      valor: String(eventos.length),
      pista: etiquetaPeriodo,
      significado: "Cantidad de eventos que cumplen los filtros; es la base de todas las gráficas.",
      calculo: "Conteo de registros del catálogo dentro del periodo, la zona y los rangos elegidos.",
    },
    {
      id: "faltantes",
      etiqueta: "Datos faltantes",
      valor: String(faltantes),
      pista: `Prof.: ${sinProfundidad} · Tipo mag.: ${sinTipo}`,
      significado: "Campos sin valor en la selección. No se imputan; se excluyen del cálculo y se informan.",
      calculo: "Cuenta de eventos sin profundidad más eventos sin tipo de magnitud.",
    },
    {
      id: "media",
      etiqueta: "Magnitud media",
      valor: fmt2(media(magnitudes)),
      pista: `Mediana ${fmt2(mediana(magnitudes))}`,
      significado: "Promedio de las magnitudes de la selección. Mezcla tipos (Mw, ML, mb), que no son estrictamente comparables.",
      calculo: "Suma de magnitudes ÷ n. La mediana es el valor central.",
    },
    {
      id: "desv",
      etiqueta: "Desv. estándar (mag.)",
      valor: fmt2(desviacion(magnitudes)),
      pista: "Dispersión de la magnitud",
      significado: "Qué tanto se alejan las magnitudes de su promedio.",
      calculo: "Raíz de la suma de (xᵢ − media)² ÷ (n − 1).",
    },
    {
      id: "prof",
      etiqueta: "Profundidad mediana",
      valor: profundidades.length ? `${fmt2(mediana(profundidades))} km` : "—",
      pista: `P25–P75: ${fmt2(cuantil(profundidades, 0.25))}–${fmt2(cuantil(profundidades, 0.75))}`,
      significado: "Profundidad central del foco, sin contar eventos sin dato.",
      calculo: `Valor central de las profundidades ordenadas (n = ${profundidades.length}).`,
    },
    {
      id: "tasa",
      etiqueta: "Tasa diaria",
      valor: fmt2(eventos.length / dias),
      pista: "eventos por día",
      significado: "Eventos reportados por día en promedio durante el periodo.",
      calculo: `n ÷ días del periodo (${fmt2(dias)} días).`,
    },
    {
      id: "corr",
      etiqueta: metodo === "spearman" ? "ρ Spearman" : "r Pearson",
      valor: dispersion.puntos.length >= 3 ? fmt2(dispersion.r) : "—",
      pista: `${dispersion.xLabel} vs ${dispersion.yLabel}`,
      significado: "Asociación numérica entre dos variables, entre −1 y 1. No implica causalidad ni permite predecir sismos.",
      calculo: `Coeficiente ${metodo === "spearman" ? "de Spearman (correlación de rangos)" : "de Pearson (lineal)"} sobre ${dispersion.puntos.length} eventos con ambos valores.`,
    },
  ];
  return { kpis, faltantes };
}

/* ── Cálculo completo ─────────────────────────────────── */

export function calcular(f: FiltrosAnalisis, catalogo: SeismicEvent[]): ResultadoAnalisis {
  const eventos = eventosFiltrados(f, catalogo);
  const periodoId = f.periodo === "rango" ? "custom" : f.periodo;
  const etiquetaPeriodo = periodLabel(periodoId, f.desde, f.hasta);

  const { start, end } = periodBounds(periodoId, f.desde, f.hasta);
  const dias =
    Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(1, (end - start) / 864e5)
      : 30;

  const profundidades = histogramaProfundidad(eventos);
  const dispersion = calcularDispersion(f, eventos);
  const { kpis, faltantes } = calcularKpis(eventos, etiquetaPeriodo, dispersion, f.metodo, dias);

  return {
    filtros: f,
    n: eventos.length,
    faltantes,
    serie: calcularSerie(eventos, f.agrupacion, { start, end }),
    magnitudes: { puntos: histogramaMagnitud(eventos, f.resolucion) },
    profundidades,
    regiones: { puntos: conteoPorRegion(eventos, f.top) },
    dispersion,
    resumen: tablaResumen(eventos),
    eventos: tablaEventos(eventos),
    kpis,
    etiquetaPeriodo,
    etiquetaFiltros: resumenFiltros(f),
  };
}
