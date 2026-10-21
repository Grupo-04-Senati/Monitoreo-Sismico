import type { Canal, Condicion, EstadoAviso, EstadoEntrega, Regla, ReglaIn, Severidad, TipoMagnitud, Zona } from "../types";

/* Etiquetas, formatos y formulario de "Reglas de alertas" y "Centro de alertas".
   Colores NEUTROS: la severidad y el estado son datos operativos, no niveles de peligro
   (el plan pide no alarmar; lo oficial lo comunican IGP/INDECI). */

export const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  informativa: "Informativa",
  importante: "Importante",
  critica: "Crítica",
};

/** Más peso visual a más severidad, sin rojo ni ámbar. */
export const COLOR_SEVERIDAD: Record<Severidad, string> = {
  informativa: "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300",
  importante: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  critica: "bg-slate-700 font-semibold text-white dark:bg-slate-200 dark:text-slate-900",
};

export const SIMBOLO_SEVERIDAD: Record<Severidad, string> = { informativa: "○", importante: "◐", critica: "●" };

export const ETIQUETA_ESTADO: Record<EstadoAviso, string> = {
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  enviada: "Enviada",
  fallida: "Con entrega fallida",
  cancelada: "Cancelada",
  suprimida: "Suprimida (espera)",
};

export const COLOR_ESTADO: Record<EstadoAviso, string> = {
  pendiente_aprobacion: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  aprobada: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  enviada: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  fallida: "border border-slate-500 text-slate-800 dark:border-slate-400 dark:text-slate-100",
  cancelada: "bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400",
  suprimida: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

/** Orden de las pestañas del centro: primero lo que pide acción. */
export const ESTADOS_AVISO: EstadoAviso[] = ["pendiente_aprobacion", "fallida", "aprobada", "enviada", "suprimida", "cancelada"];

export const ETIQUETA_ENTREGA: Record<EstadoEntrega, string> = {
  entregada: "Entregada",
  simulada: "Simulada (correo desactivado)",
  fallida: "Fallida",
};

export const ETIQUETA_CANAL: Record<Canal, string> = { app: "Plataforma", email: "Correo" };

export const TIPOS_MAGNITUD: TipoMagnitud[] = ["Mw", "ML", "mb"];

export const DIAS_SIMULACION = [
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 365, label: "1 año" },
  { value: 1825, label: "5 años" },
];

export const MARCADORES = ["magnitud", "tipo", "lugar", "fecha", "profundidad", "distancia", "zona", "regla", "enlace"];

/* ── Formatos ─────────────────────────────────────────────────── */

const num = (v: number, d = 1) => v.toLocaleString("es-PE", { maximumFractionDigits: d });

export function resumenCondicion(c: Condicion): string {
  const partes = [`M ≥ ${num(c.magnitud_minima)}`];
  const min = c.profundidad_min_km;
  const max = c.profundidad_max_km;
  if (min != null && max != null) partes.push(`${num(min, 0)}–${num(max, 0)} km de prof.`);
  else if (min != null) partes.push(`≥ ${num(min, 0)} km de prof.`);
  else if (max != null) partes.push(`≤ ${num(max, 0)} km de prof.`);
  if (c.tipos_magnitud?.length) partes.push(c.tipos_magnitud.join(", "));
  if (c.solo_revisados) partes.push("solo revisados");
  return partes.join(" · ");
}

export function resumenZona(z: Zona): string {
  if (z.tipo !== "circulo" || z.lat == null || z.lon == null || z.radio_km == null) return "Toda la cobertura";
  const centro = `(${z.lat.toFixed(2)}, ${z.lon.toFixed(2)})`;
  return `${z.nombre ? `${z.nombre}: ` : ""}${num(z.radio_km, 0)} km de ${centro}`;
}

export function fmtEspera(segundos: number): string {
  if (segundos <= 0) return "Sin espera";
  const min = Math.round(segundos / 60);
  if (min % 1440 === 0) return `${min / 1440} d`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}

export function fmtMagnitud(m: number | null, tipo: string | null): string {
  return m == null ? "—" : `M${m.toFixed(1)}${tipo ? ` ${tipo}` : ""}`;
}

export function fmtKm(v: number | null | undefined): string {
  return v == null ? "—" : `${num(v, 0)} km`;
}

/* ── Formulario ───────────────────────────────────────────────── */

/** Estado del formulario: los números van como texto para no forzar valores al escribir. */
export interface FormRegla {
  name: string;
  description: string;
  magnitud: string;
  profMin: string;
  profMax: string;
  soloRevisados: boolean;
  tipos: TipoMagnitud[];
  zonaTipo: "todo" | "circulo";
  zonaNombre: string;
  lat: string;
  lon: string;
  radio: string;
  severidad: Severidad;
  app: boolean;
  email: boolean;
  destinatarios: string;
  cooldown: string;
  requiereAprobacion: boolean;
  antiguedad: string;
  /** Vacío = plantilla por defecto del servidor (incluye la nota "no es una alerta oficial"). */
  plantillaTitulo: string;
  plantillaMensaje: string;
}

export const FORM_VACIO: FormRegla = {
  name: "",
  description: "",
  magnitud: "4.5",
  profMin: "",
  profMax: "",
  soloRevisados: false,
  tipos: [],
  zonaTipo: "todo",
  zonaNombre: "",
  lat: "",
  lon: "",
  radio: "",
  severidad: "importante",
  app: true,
  email: false,
  destinatarios: "",
  cooldown: "60",
  requiereAprobacion: true,
  antiguedad: "24",
  plantillaTitulo: "",
  plantillaMensaje: "",
};

const txt = (v: number | null | undefined) => (v == null ? "" : String(v));

export function formDesdeRegla(r: Regla): FormRegla {
  const c = r.condition_json;
  const z = r.zone_spec;
  return {
    name: r.name,
    description: r.description ?? "",
    magnitud: String(c.magnitud_minima),
    profMin: txt(c.profundidad_min_km),
    profMax: txt(c.profundidad_max_km),
    soloRevisados: !!c.solo_revisados,
    tipos: c.tipos_magnitud ?? [],
    zonaTipo: z.tipo === "circulo" ? "circulo" : "todo",
    zonaNombre: z.nombre ?? "",
    lat: txt(z.lat),
    lon: txt(z.lon),
    radio: txt(z.radio_km),
    severidad: r.severity,
    app: r.channels.includes("app"),
    email: r.channels.includes("email"),
    destinatarios: r.recipients.join(", "),
    cooldown: String(Math.round(r.cooldown_seconds / 60)),
    requiereAprobacion: r.requires_approval,
    antiguedad: String(r.max_event_age_hours),
    plantillaTitulo: r.title_template,
    plantillaMensaje: r.message_template,
  };
}

const CORREO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function listaDestinatarios(texto: string): string[] {
  return texto.split(/[\s,;]+/).map((d) => d.trim()).filter(Boolean);
}

function numero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Primer problema del formulario, o null si está listo para enviar. */
export function validarRegla(f: FormRegla): string | null {
  if (f.name.trim().length < 3) return "El nombre necesita al menos 3 caracteres.";
  const m = numero(f.magnitud);
  if (m == null || Number.isNaN(m) || m < 0 || m > 10) return "La magnitud mínima debe estar entre 0 y 10.";
  const pmin = numero(f.profMin);
  const pmax = numero(f.profMax);
  for (const p of [pmin, pmax]) if (p != null && (Number.isNaN(p) || p < 0 || p > 750)) return "La profundidad va de 0 a 750 km.";
  if (pmin != null && pmax != null && pmin > pmax) return "La profundidad mínima no puede superar a la máxima.";
  if (f.zonaTipo === "circulo") {
    const lat = numero(f.lat);
    const lon = numero(f.lon);
    const radio = numero(f.radio);
    if (lat == null || Number.isNaN(lat) || lat < -90 || lat > 90) return "La latitud del centro va de −90 a 90.";
    if (lon == null || Number.isNaN(lon) || lon < -180 || lon > 180) return "La longitud del centro va de −180 a 180.";
    if (radio == null || Number.isNaN(radio) || radio <= 0 || radio > 2000) return "El radio va de 1 a 2000 km.";
  }
  if (!f.app && !f.email) return "Elige al menos un canal.";
  const destinos = listaDestinatarios(f.destinatarios);
  if (f.email && destinos.length === 0) return "El canal de correo necesita al menos un destinatario.";
  if (destinos.length > 20) return "Máximo 20 destinatarios.";
  const malo = destinos.find((d) => !CORREO.test(d));
  if (malo) return `"${malo}" no parece un correo válido.`;
  const espera = numero(f.cooldown);
  if (espera == null || Number.isNaN(espera) || !Number.isInteger(espera) || espera < 0 || espera > 10080)
    return "La espera entre avisos va de 0 a 10080 minutos (7 días).";
  const edad = numero(f.antiguedad);
  if (edad == null || Number.isNaN(edad) || !Number.isInteger(edad) || edad < 1 || edad > 720)
    return "La antigüedad máxima va de 1 a 720 horas.";
  return null;
}

/** Convierte un formulario válido en el cuerpo que espera la API. */
export function reglaDesdeForm(f: FormRegla): ReglaIn {
  const n = (t: string) => numero(t) ?? null;
  const regla: ReglaIn = {
    name: f.name.trim(),
    description: f.description.trim() || null,
    condicion: {
      magnitud_minima: n(f.magnitud) ?? 0,
      profundidad_min_km: n(f.profMin),
      profundidad_max_km: n(f.profMax),
      solo_revisados: f.soloRevisados,
      tipos_magnitud: f.tipos.length ? f.tipos : null,
    },
    zona:
      f.zonaTipo === "circulo"
        ? { tipo: "circulo", nombre: f.zonaNombre.trim() || null, lat: n(f.lat), lon: n(f.lon), radio_km: n(f.radio) }
        : { tipo: "todo" },
    severidad: f.severidad,
    canales: [...(f.app ? (["app"] as const) : []), ...(f.email ? (["email"] as const) : [])],
    destinatarios: listaDestinatarios(f.destinatarios),
    cooldown_minutos: n(f.cooldown) ?? 60,
    requiere_aprobacion: f.requiereAprobacion,
    antiguedad_max_horas: n(f.antiguedad) ?? 24,
  };
  if (f.plantillaTitulo.trim()) regla.plantilla_titulo = f.plantillaTitulo.trim();
  if (f.plantillaMensaje.trim()) regla.plantilla_mensaje = f.plantillaMensaje.trim();
  return regla;
}

/** Regla guardada → cuerpo para simularla tal como está. */
export function reglaInDesdeRegla(r: Regla): ReglaIn {
  return reglaDesdeForm(formDesdeRegla(r));
}
