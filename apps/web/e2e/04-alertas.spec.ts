import { expect, test, type Page } from "@playwright/test";
import { generarAvisos, iniciarSesion } from "./ayuda";

/* Reglas y Centro de alertas (PDF §14): probar la condición antes de activar, solo el
   Administrador activa, no hay duplicados y la entrega se puede consultar. */

const REGLA = "e2e Mina Arequipa M5";

async function abrirRegla(page: Page) {
  await page.goto("/reglas-alertas");
  await page.getByRole("button", { name: new RegExp(REGLA) }).click();
  await expect(page.getByRole("dialog", { name: `Regla · ${REGLA}` })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("el Operador crea una regla, la simula y no puede activarla", async ({ page }) => {
  await iniciarSesion(page, "operador");
  await page.goto("/reglas-alertas");
  await page.getByRole("button", { name: "Nueva regla" }).click();
  const editor = page.getByRole("dialog", { name: "Nueva regla de aviso" });

  await editor.getByPlaceholder("p. ej. Mina Arequipa M4.5").fill(REGLA);
  await editor.getByRole("textbox").nth(2).fill("5"); // magnitud mínima
  await editor.getByRole("button", { name: "Radio alrededor de un punto" }).click();
  await editor.getByPlaceholder("Mina Arequipa", { exact: true }).fill("Mina Arequipa");
  await editor.getByPlaceholder("150").fill("400");
  await editor.getByPlaceholder("-16.40").fill("-16.4");
  await editor.getByPlaceholder("-71.50").fill("-71.5");

  await editor.getByLabel("Periodo de la simulación").selectOption("1825");
  await editor.getByRole("button", { name: "Simular" }).click();
  await expect(editor.getByText("Cumplen la regla", { exact: true })).toBeVisible();
  await expect(editor.locator("table tbody tr").first()).toBeVisible();

  await editor.getByRole("button", { name: "Crear regla" }).click();
  const ficha = page.getByRole("dialog", { name: `Regla · ${REGLA}` });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByText("Inactiva").first()).toBeVisible();
  await expect(ficha.getByRole("button", { name: "Activar" })).toHaveCount(0);
});

test("el Administrador la activa y el motor genera avisos sin duplicar", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await abrirRegla(page);
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Desactivar" })).toBeVisible();

  const primera = Number(generarAvisos().match(/Avisos generados: (\d+)/)![1]);
  expect(primera).toBeGreaterThan(0);
  const segunda = Number(generarAvisos().match(/Avisos generados: (\d+)/)![1]);
  expect(segunda).toBe(0); // deduplicación por sismo y regla
});

test("el Operador aprueba un aviso y consulta su entrega", async ({ page }) => {
  await iniciarSesion(page, "operador");
  await page.goto("/alertas?estado=pendiente_aprobacion");
  const fila = page.locator("table tbody tr").first();
  await expect(fila).toBeVisible();
  await fila.click();
  const detalle = page.getByRole("dialog");
  await expect(detalle.getByText("Aviso interno · no es alerta oficial")).toBeVisible();
  await detalle.getByRole("button", { name: "Aprobar y enviar" }).click();
  await expect(detalle.getByText("Enviada").first()).toBeVisible();
  await expect(detalle.getByText("Entregada")).toBeVisible();
  await expect(detalle.getByText("Simulada (correo desactivado)").or(detalle.getByText("Plataforma"))).toBeVisible();
});

test("la creación y la activación quedan en la Auditoría", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto("/auditoria?entity_type=alert_rule");
  const tabla = page.locator("table");
  await expect(tabla.getByText("Regla creada").first()).toBeVisible();
  await expect(tabla.getByText("Regla activada").first()).toBeVisible();
  await expect(tabla.getByText("E2E Operador").first()).toBeVisible();
});
