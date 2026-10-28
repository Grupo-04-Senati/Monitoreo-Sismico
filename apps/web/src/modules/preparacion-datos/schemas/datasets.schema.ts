import type { EstadoDataset, NuevoDataset, ReglaDuplicados, ReglaProfundidad, TipoMagnitudPermitido, Variable, ZonaDataset } from "../types";

/* Etiquetas, opciones y validación del formulario (espejo de las reglas del
   backend: `services/api/app/schemas/datasets.py`). */

export const ETIQUETA_ESTADO: Record<EstadoDataset, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
};

export const SIMBOLO_ESTADO: Record<EstadoDataset, string> = {
  borrador: "○",
  aprobado: "●",
};

/** Colores neutros: un estado de dataset no es un nivel de peligro. */
export const COLOR_ESTADO: Record<EstadoDataset, string> = {
  borrador: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  aprobado: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
};

export const VARIABLES: { value: Variable; label: string }[] = [
  { value: "occurred_at", label: "Fecha y hora (UTC)" },
  { value: "latitude", label: "Latitud" },
  { value: "longitude", label: "Longitud" },
  { value: "depth_km", label: "Profundidad (km)" },
  { value: "magnitude", label: "Magnitud" },
  { value: "magnitude_type", label: "Tipo de magnitud" },
];

export const ETIQUETA_VARIABLE: Record<string, string> = Object.fromEntries(VARIABLES.map((v) => [v.value, v.label]));

export const TIPOS_MAGNITUD: TipoMagnitudPermitido[] = ["Mw", "mb", "ML"];

export const OPCIONES_PROFUNDIDAD: { value: ReglaProfundidad; label: string }[] = [
  { value: "conservar", label: "Conservar (quedan vacíos)" },
  { value: "imputar_mediana", label: "Imputar con la mediana" },
  { value: "excluir", label: "Excluir esos eventos" },
];

export const OPCIONES_DUPLICADOS: { value: ReglaDuplicados; label: string }[] = [
  { value: "conservar", label: "Conservar (pueden ser réplicas)" },
  { value: "excluir", label: "Excluir" },
];

/** Nombre legible de cada regla del informe (`eliminadas_por_regla`). */
export const ETIQUETA_REGLA: Record<string, string> = {
  duplicados_exactos: "Duplicados exactos",
  posibles_duplicados: "Posibles duplicados",
  no_revisados: "No revisados",
  tipo_de_magnitud: "Tipo de magnitud no permitido",
  bajo_magnitud_minima: "Bajo la magnitud mínima",
  sin_profundidad: "Sin profundidad",
};

export const ETIQUETA_CAMPO: Record<string, string> = {
  depth_km: "Profundidad",
  magnitude: "Magnitud",
  magnitude_type: "Tipo de magnitud",
  region: "Región",
  locality: "Localidad",
  source_url: "Enlace de procedencia",
};

export const ETIQUETA_REVISION: Record<string, string> = {
  observado: "Observado",
  pendiente_validacion: "Pendiente de validación",
};

export const ZONA_TODA: ZonaDataset = { tipo: "todo", departamentos: [], nombre: null, lat: null, lon: null, radio_km: null };

/** Texto de la zona, igual que el del backend. */
export function describirZona(z: ZonaDataset | null | undefined): string {
  if (!z || z.tipo === "todo") return "Toda la cobertura del catálogo (Perú y alrededores)";
  if (z.tipo === "departamentos") return `Departamentos: ${z.departamentos.join(", ")}`;
  const lugar = z.nombre || `(${z.lat?.toFixed(2)}, ${z.lon?.toFixed(2)})`;
  return `${lugar}: ${z.radio_km} km a la redonda`;
}

export function formularioInicial(desde: string, hasta: string): NuevoDataset {
  return {
    name: "",
    description: null,
    fuente: null,
    desde,
    hasta,
    reglas: {
      magnitud_minima: null,
      solo_revisados: false,
      tipos_magnitud: null,
      sin_profundidad: "conservar",
      posibles_duplicados: "conservar",
    },
    zona: ZONA_TODA,
    variables: ["occurred_at", "latitude", "longitude", "depth_km"],
    variable_objetivo: "magnitude",
    fecha_corte: null,
  };
}

/** Misma validación que el backend; devuelve el primer problema o `null`. */
export function validarFormulario(f: NuevoDataset): string | null {
  const nombre = f.name.trim();
  if (nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (!f.desde || !f.hasta) return "Indica el periodo completo.";
  if (f.desde > f.hasta) return "«Desde» debe ser anterior o igual a «Hasta».";
  if (f.fecha_corte && !(f.desde < f.fecha_corte && f.fecha_corte <= f.hasta))
    return "La fecha de corte debe caer dentro del periodo (después de «Desde»).";
  if (f.variables.length === 0) return "Elige al menos una variable.";
  if (f.variable_objetivo && f.variables.includes(f.variable_objetivo))
    return "La variable objetivo no puede estar también entre las variables.";
  const m = f.reglas.magnitud_minima;
  if (m != null && (m < 0 || m > 10)) return "La magnitud mínima debe estar entre 0 y 10.";
  if (f.reglas.tipos_magnitud && f.reglas.tipos_magnitud.length === 0)
    return "Elige al menos un tipo de magnitud o desactiva el filtro.";
  const z = f.zona;
  if (z.tipo === "departamentos" && z.departamentos.length === 0) return "Elige al menos un departamento para la zona.";
  if (z.tipo === "circulo") {
    if (z.lat == null || z.lat < -90 || z.lat > 90) return "La latitud del centro va de −90 a 90.";
    if (z.lon == null || z.lon < -180 || z.lon > 180) return "La longitud del centro va de −180 a 180.";
    if (z.radio_km == null || z.radio_km <= 0 || z.radio_km > 2000) return "El radio de la zona va de 1 a 2000 km.";
  }
  return null;
}

/** Día UTC de un instante (los periodos y cortes de un dataset son días UTC). */
export function fmtDiaUTC(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}
