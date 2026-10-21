import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./ayuda";

/* Configuración (D20, D23): estado del sistema y control de cambios de un parámetro. */

test("el Administrador ve el estado del sistema", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto("/configuracion");
  await expect(page.getByRole("heading", { name: "Estado del sistema" })).toBeVisible();
  await expect(page.getByText("Base de datos")).toBeVisible();
  await expect(page.getByText(/Ingesta · USGS/)).toBeVisible();
});

test("cambiar un parámetro queda en el control de cambios", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto("/configuracion");
  const tarjeta = page.locator("div").filter({ has: page.getByRole("heading", { name: "Vigencia de los reportes descargables" }) }).last();
  const campo = tarjeta.getByRole("textbox");
  await expect(campo).toHaveValue("24");
  await campo.fill("36");
  await tarjeta.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Vigencia de los reportes descargables: 24 → 36/).first()).toBeVisible();
  await expect(page.getByRole("textbox").first()).toHaveValue("36");
});
