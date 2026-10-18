import type { ChipFiltro, ErroresFiltros, FiltrosMapa, OpcionFiltro } from "../types";
import { REGION_OPTIONS, periodLabel } from "@/lib/catalogo";

/* ════════════════════════════════════════════════════════════════
   Opciones, validación y serialización a la URL de los filtros del mapa.

   La URL es la fuente de la verdad: el estado es compartible y los enlaces
   llegan con los filtros aplicados.
   ════════════════════════════════════════════════════════════════ */

export const PERIODO_POR_DEFECTO = "30d";

export const FILTROS_POR_DEFECTO: FiltrosMapa = {
  periodo: PERIODO_POR_DEFECTO,
  desde: "",
  hasta: "",
  region: "",
  magnitudMin: null,
  magnitudMax: null,
  capa: "ambos",
  estado: "",
  rlat: null,
  rlon: null,
  radioKm: null,
};

export const LIMITES_MAGNITUD = { min: 2, max: 7 } as const;
export const LIMITES_RADIO_KM = { min: 5, max: 1000 } as const;

export const PERIODOS: OpcionFiltro[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "custom", label: "Personalizado" },
];

export const CAPAS: OpcionFiltro[] = [
  { value: "ambos", label: "Regiones y eventos" },
  { value: "regiones", label: "Solo regiones" },
  { value: "eventos", label: "Solo eventos" },
];

export const ESTADOS: OpcionFiltro[] = [
  { value: "", label: "Todos" },
  { value: "observado", label: "Observado" },
  { value: "pendiente_validacion", label: "Pendiente de validación" },
];

export const ETIQUETA_ESTADO: Record<"observado" | "pendiente_validacion", string> = {
  observado: "Observado",
  pendiente_validacion: "Pendiente de validación",
};

export const REGIONES: OpcionFiltro[] = REGION_OPTIONS.map((r) => ({ value: r.slug, label: r.name }));

export const ETIQUETA_CAPA: Record<string, string> = Object.fromEntries(CAPAS.map((c) => [c.value, c.label]));

function numeroOParcial(valor: string | null): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function nombreRegion(slug: string): string {
  return REGION_OPTIONS.find((r) => r.slug === slug)?.name ?? slug;
}

/* ════ Validación ════ */

export function validarFiltros(f: FiltrosMapa): ErroresFiltros {
  const errores: ErroresFiltros = {};
  if (f.periodo === "custom" && f.desde && f.hasta && f.desde > f.hasta) {
    errores.hasta = "La fecha final no puede ser anterior a la inicial.";
  }
  if (f.magnitudMin != null && f.magnitudMax != null && f.magnitudMin > f.magnitudMax) {
    errores.magnitud = "La magnitud mínima no puede ser mayor que la máxima.";
  }
  const tieneCentro = f.rlat != null && f.rlon != null;
  const tieneRadio = f.radioKm != null;
  if (tieneCentro !== tieneRadio) {
    errores.radio = "Completa la latitud, la longitud y el radio (km) para buscar por distancia.";
  } else if (tieneRadio && (f.radioKm as number) <= 0) {
    errores.radio = "El radio debe ser mayor que 0 km.";
  }
  return errores;
}

export function hayFiltrosActivos(f: FiltrosMapa): boolean {
  return (
    f.periodo !== PERIODO_POR_DEFECTO ||
    Boolean(f.desde) ||
    Boolean(f.hasta) ||
    Boolean(f.region) ||
    f.magnitudMin != null ||
    f.magnitudMax != null ||
    f.capa !== "ambos" ||
    Boolean(f.estado) ||
    f.rlat != null ||
    f.rlon != null ||
    f.radioKm != null
  );
}

/* ════ URL ⇄ filtros ════ */

export function filtrosDesdeParams(params: URLSearchParams): FiltrosMapa {
  const estadoParam = params.get("estado");
  const estado: FiltrosMapa["estado"] =
    estadoParam === "observado" || estadoParam === "pendiente_validacion" ? estadoParam : "";
  const capaParam = params.get("capa");
  const capa: FiltrosMapa["capa"] =
    capaParam === "ambos" || capaParam === "regiones" || capaParam === "eventos" ? capaParam : "ambos";
  return {
    periodo: params.get("periodo") || PERIODO_POR_DEFECTO,
    desde: params.get("desde") ?? "",
    hasta: params.get("hasta") ?? "",
    region: params.get("region") ?? "",
    magnitudMin: numeroOParcial(params.get("magMin")),
    magnitudMax: numeroOParcial(params.get("magMax")),
    capa,
    estado,
    rlat: numeroOParcial(params.get("rlat")),
    rlon: numeroOParcial(params.get("rlon")),
    radioKm: numeroOParcial(params.get("radioKm")),
  };
}

export function filtrosAParams(f: FiltrosMapa): URLSearchParams {
  const p = new URLSearchParams();
  if (f.periodo !== PERIODO_POR_DEFECTO) p.set("periodo", f.periodo);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.region) p.set("region", f.region);
  if (f.magnitudMin != null) p.set("magMin", String(f.magnitudMin));
  if (f.magnitudMax != null) p.set("magMax", String(f.magnitudMax));
  if (f.capa !== "ambos") p.set("capa", f.capa);
  if (f.estado) p.set("estado", f.estado);
  if (f.rlat != null) p.set("rlat", String(f.rlat));
  if (f.rlon != null) p.set("rlon", String(f.rlon));
  if (f.radioKm != null) p.set("radioKm", String(f.radioKm));
  return p;
}

/* ════ Chips ════ */

export function chipsDesdeFiltros(f: FiltrosMapa): ChipFiltro[] {
  const chips: ChipFiltro[] = [];

  if (f.periodo === "custom") {
    if (f.desde || f.hasta) chips.push({ clave: "rango", etiqueta: `Fechas: ${f.desde || "…"} – ${f.hasta || "…"}` });
  } else if (f.periodo !== PERIODO_POR_DEFECTO) {
    chips.push({ clave: "periodo", etiqueta: periodLabel(f.periodo, f.desde, f.hasta) });
  }

  if (f.region) chips.push({ clave: "region", etiqueta: `Región: ${nombreRegion(f.region)}` });
  if (f.magnitudMin != null) chips.push({ clave: "magnitudMin", etiqueta: `Magnitud ≥ ${f.magnitudMin.toFixed(1)}` });
  if (f.magnitudMax != null) chips.push({ clave: "magnitudMax", etiqueta: `Magnitud ≤ ${f.magnitudMax.toFixed(1)}` });
  if (f.capa !== "ambos") chips.push({ clave: "capa", etiqueta: `Capa: ${ETIQUETA_CAPA[f.capa] ?? f.capa}` });
  if (f.estado) chips.push({ clave: "estado", etiqueta: `Estado: ${ETIQUETA_ESTADO[f.estado]}` });
  if (f.rlat != null && f.rlon != null) {
    const km = f.radioKm != null ? `${f.radioKm} km` : "sin radio";
    chips.push({ clave: "radio", etiqueta: `Radio: ${f.rlat.toFixed(2)}, ${f.rlon.toFixed(2)} · ${km}` });
  }

  return chips;
}

export function filtroSinChip(clave: string): Partial<FiltrosMapa> {
  switch (clave) {
    case "rango":
    case "periodo":
      return { periodo: PERIODO_POR_DEFECTO, desde: "", hasta: "" };
    case "region":
      return { region: "" };
    case "magnitudMin":
      return { magnitudMin: null };
    case "magnitudMax":
      return { magnitudMax: null };
    case "capa":
      return { capa: "ambos" };
    case "estado":
      return { estado: "" };
    case "radio":
      return { rlat: null, rlon: null, radioKm: null };
    default:
      return {};
  }
}

/** Frase corta con los filtros activos (para el pie y la exportación). */
export function resumenFiltros(f: FiltrosMapa): string {
  const partes: string[] = [];

  if (f.periodo === "custom") {
    if (f.desde || f.hasta) partes.push(`${f.desde || "…"} – ${f.hasta || "…"}`);
  } else {
    partes.push(periodLabel(f.periodo, f.desde, f.hasta));
  }

  if (f.region) partes.push(nombreRegion(f.region));
  if (f.magnitudMin != null || f.magnitudMax != null) {
    const lo = f.magnitudMin != null ? f.magnitudMin.toFixed(1) : "—";
    const hi = f.magnitudMax != null ? f.magnitudMax.toFixed(1) : "—";
    partes.push(`mag. ${lo}–${hi}`);
  }
  if (f.capa !== "ambos") partes.push(`capa ${ETIQUETA_CAPA[f.capa] ?? f.capa}`);
  if (f.estado) partes.push(ETIQUETA_ESTADO[f.estado]);
  if (f.rlat != null && f.rlon != null && f.radioKm != null) {
    partes.push(`radio ${f.radioKm} km`);
  }
  return partes.join(" · ");
}
