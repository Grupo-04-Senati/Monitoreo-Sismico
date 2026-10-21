import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./ayuda";

/* Roles (PDF §14): la interfaz oculta lo que el rol no puede usar y la ruta directa
   muestra "Acceso denegado"; la API responde 403 aunque se llame a mano. */

const menu = (page: import("@playwright/test").Page) => page.locator(`[aria-label="Navegación principal"]`);

test("el Analista no ve Configuración, Usuarios ni Reglas, y la API se lo niega", async ({ page }) => {
  await iniciarSesion(page, "analista");
  const nav = menu(page);
  await expect(nav.getByRole("link", { name: "Estimaciones" })).toBeVisible();
  for (const oculto of ["Configuración", "Usuarios y roles", "Reglas de alertas", "Auditoría"]) {
    await expect(nav.getByRole("link", { name: oculto })).toHaveCount(0);
  }
  await page.goto("/configuracion");
  await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();

  const respuesta = await page.request.get("/api/v1/settings");
  expect(respuesta.status()).toBe(403);
});

test("el Operador de alertas ve Reglas y Centro de alertas, pero no Configuración", async ({ page }) => {
  await iniciarSesion(page, "operador");
  const nav = menu(page);
  await expect(nav.getByRole("link", { name: "Reglas de alertas" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Centro de alertas" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  expect((await page.request.get("/api/v1/audit-logs")).status()).toBe(403);
});
