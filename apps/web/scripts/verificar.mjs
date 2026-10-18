/* Verificación de conexión frontend → API, módulo por módulo.

   Ejecuta las funciones reales de los servicios del frontend (modo API, sin mock)
   contra una API en marcha, con una cookie de sesión, y vuelca lo que devuelven.
   Sirve para comprobar que cada módulo llama a /api/v1/... y refleja la base.

   Uso:
     node scripts/verificar.mjs usuarios
     node scripts/verificar.mjs eventos
     node scripts/verificar.mjs mapa
     node scripts/verificar.mjs fuentes
     node scripts/verificar.mjs reportes
     node scripts/verificar.mjs analisis
     node scripts/verificar.mjs dashboard

   Salida: JSON con lo devuelto por cada función. Sale con código 2 si algo falla. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..", "..");
const require = createRequire(ROOT + "/package.json");
const esbuild = require("esbuild");

const ENTRADA = `
import { apiGet, apiPost } from "@/lib/api";
import { aplicarMeta } from "@/lib/ancla";
import * as usuarios from "@/modules/usuarios-roles/services/usuarios.service";
import * as eventos from "@/modules/eventos/services/eventos.service";
import * as mapa from "@/modules/mapa-sismico/services/mapa.service";
import * as fuentes from "@/modules/fuentes-datos/services/fuentes.service";
import * as reportes from "@/modules/reportes/services/reportes.service";
import * as analisis from "@/modules/analisis/services/analisis.service";
import * as dashboard from "@/modules/dashboard/services/dashboard.service";
import { FILTROS_POR_DEFECTO } from "@/modules/analisis/schemas/analisis.schema";

const realFetch = globalThis.fetch;
let cookie = "";
globalThis.fetch = async (url, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await realFetch(url, { ...opts, headers });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return res;
};

const mod = process.argv[2];
const salida = { modulo: mod, probes: {} };
async function probe(nombre, fn) {
  try { salida.probes[nombre] = await fn(); }
  catch (e) { salida.probes[nombre] = { __error: (e && e.message) || String(e) }; }
}

async function main() {
  const email = process.env.VERIF_EMAIL;
  const password = process.env.VERIF_PASS;
  if (!email || !password) {
    throw new Error("Define VERIF_EMAIL y VERIF_PASS con una cuenta existente para ejecutar la verificación.");
  }
  await apiPost("/auth/login", { email, password });
  aplicarMeta(await apiGet("/meta"));

  if (mod === "usuarios") {
    await probe("resumen", async () => usuarios.cargarResumen());
    const p = await probe("listado", async () => {
      const r = await usuarios.listarUsuarios({ estado: "", rol: "", q: "", ultimoAcceso: "", orden: "recientes" }, 1, 5);
      return { total: r.total, totalPaginas: r.totalPaginas, filas: r.filas.map((u) => ({ id: u.id, nombre: u.nombre, estado: u.estado, roles: u.roles, ultimo: u.ultimoAccesoUtc })) };
    });
    await probe("porRol", async () => usuarios.contarUsuariosPorRol());
    const primero = salida.probes.listado && salida.probes.listado.filas && salida.probes.listado.filas[0];
    if (primero) await probe("actividad", async () => (await usuarios.obtenerActividad(primero.id)).slice(0, 3));
  } else if (mod === "eventos") {
    await probe("catalogo", async () => { const c = await eventos.cargarCatalogo(); return { n: c.length, primero: c[0] }; });
    await probe("listado", async () => {
      const r = await eventos.listarEventos({ periodo: "30d", desde: "", hasta: "", region: "", magnitudMin: null, magnitudMax: null, magnitudTipo: "", profundidadMin: null, profundidadMax: null, q: "", estado: "" }, { campo: "fecha", direccion: "desc" }, { numero: 1, tamano: 3 });
      return { total: r.total, filas: r.filas.map((e) => ({ id: e.id, mag: e.magnitude, prof: e.depthKm, tipo: e.magnitudeType })) };
    });
    await probe("procedencia", async () => eventos.obtenerProcedencia());
  } else if (mod === "mapa") {
    await probe("catalogo", async () => { const c = await mapa.cargarEventosMapa(); return { n: c.length, primero: c[0] && c[0].id }; });
    await probe("regiones", async () => {
      const c = await mapa.cargarEventosMapa();
      const rs = mapa.resumirRegiones(c);
      const lima = rs.find((r) => r.slug === "lima");
      const top = rs.slice(0, 3).map((r) => ({ slug: r.slug, eventos: r.eventos }));
      return { totalRegiones: rs.length, lima: lima && lima.eventos, top };
    });
  } else if (mod === "fuentes") {
    await probe("meta", async () => fuentes.cargarMeta());
    await probe("ejecuciones", async () => { const r = await fuentes.listarEjecuciones({ estado: "", desde: "", hasta: "" }, 1, 3); return { total: r.total, filas: r.filas.slice(0, 2) }; });
    await probe("logs", async () => { const r = await fuentes.listarLogs({ estado: "", desde: "", hasta: "" }, 1, 3); return { total: r.total, filas: r.filas.slice(0, 2) }; });
    await probe("procedencia", async () => fuentes.cargarProcedencia());
  } else if (mod === "reportes") {
    await probe("tipos", async () => reportes.listarTipos());
    await probe("listado", async () => { const r = await reportes.listarReportes({ tipo: "", estado: "", q: "", solicitante: "" }, 1, 5, "u-001"); return { total: r.total, filas: r.filas.map((x) => ({ id: x.id, tipo: x.tipo, estado: x.estado, descarga: x.descargaDisponible })) }; });
    await probe("resumen", async () => reportes.resumenReportes());
  } else if (mod === "analisis") {
    const catalogo = (await eventos.cargarCatalogo()).map(analisis.desdeCatalogo);
    await probe("calcular", async () => {
      const r = analisis.calcular(FILTROS_POR_DEFECTO, catalogo);
      return { n: r.n, faltantes: r.faltantes, serie: r.serie.puntos.length, kpis: r.kpis.map((k) => ({ id: k.id, valor: k.valor })), regiones: r.regiones.puntos.slice(0, 3).map((p) => ({ l: p.label, v: p.value })) };
    });
  } else if (mod === "dashboard") {
    await probe("resumen", async () => dashboard.cargarResumen());
    await probe("fuentes", async () => dashboard.cargarFuentes());
    await probe("usuarios", async () => dashboard.contarUsuarios());
    await probe("reportes", async () => dashboard.contarReportes());
    await probe("catalogo", async () => { const e = await dashboard.cargarEventos(); return { n: e.length, primero: e[0] && e[0].id }; });
  } else {
    throw new Error("módulo desconocido: " + mod);
  }

  console.log(JSON.stringify(salida));
}

main().catch((e) => { console.error("ERROR " + ((e && e.status) || "?") + ": " + ((e && e.message) || e)); process.exit(2); });
`;

const salida = esbuild.buildSync({
  stdin: { contents: ENTRADA, resolveDir: WEB + "/src", loader: "ts" },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node20",
  alias: { "@": WEB + "/src" },
  define: {
    "import.meta.env.VITE_USE_MOCK": '"false"',
    "import.meta.env.VITE_API_BASE_URL": '"http://127.0.0.1:8000/api/v1"',
  },
  logLevel: "warning",
});

const bundlePath = path.join(process.env.TEMP || ".", "verificar.bundle.mjs");
fs.writeFileSync(bundlePath, salida.outputFiles[0].text);
const mod = process.argv[2] || "usuarios";
const out = execFileSync(process.execPath, [bundlePath, mod], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(out);
