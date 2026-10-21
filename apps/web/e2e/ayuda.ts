import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { PYTHON, RAIZ } from "../playwright.config";

/* Utilidades compartidas por los flujos E2E. */

export type Rol = "admin" | "operador" | "analista";

export const CUENTAS: Record<Rol, string> = {
  admin: "e2e-admin@empresa-ejemplo.pe",
  operador: "e2e-operador@empresa-ejemplo.pe",
  analista: "e2e-analista@empresa-ejemplo.pe",
};

export function contrasena(): string {
  const c = process.env.E2E_PASSWORD;
  if (!c) throw new Error("Falta E2E_PASSWORD (la fija playwright.config.ts).");
  return c;
}

/** Inicia sesión por la pantalla de acceso, como lo haría una persona. */
export async function iniciarSesion(page: Page, rol: Rol): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(CUENTAS[rol]);
  await page.locator("#password").fill(contrasena());
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
}

export interface SismoMuestra {
  id: string;
  properties: { mag: number; time: number; place: string; url: string };
}

/** La muestra real del USGS que cargó `tests/e2e/preparar.py`. */
export function muestra(): SismoMuestra[] {
  const ruta = path.join(RAIZ, "tests", "fixtures", "usgs_peru_2025_m45.json");
  return JSON.parse(readFileSync(ruta, "utf-8")).features as SismoMuestra[];
}

/** Ejecuta el motor de avisos sobre la muestra (ver tests/e2e/generar_avisos.py). */
export function generarAvisos(): string {
  return execFileSync(PYTHON, [path.join(RAIZ, "tests", "e2e", "generar_avisos.py")], {
    cwd: path.join(RAIZ, "services", "api"),
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    encoding: "utf-8",
  });
}
