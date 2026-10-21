import { expect, test } from "@playwright/test";
import { CUENTAS, iniciarSesion } from "./ayuda";

/* Acceso: credenciales incorrectas, entrada correcta, protección de rutas y salida. */

test("sin sesión, una pantalla protegida lleva al inicio de sesión", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("una contraseña incorrecta muestra un error genérico y no entra", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(CUENTAS.analista);
  await page.locator("#password").fill("Incorrecta#123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("el Administrador entra al Dashboard y puede salir", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("E2E Administrador").first()).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/auditoria");
  await expect(page).toHaveURL(/\/login/);
});
