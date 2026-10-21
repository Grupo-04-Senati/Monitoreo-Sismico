import { expect, test } from "@playwright/test";
import { iniciarSesion, muestra } from "./ayuda";

/* Eventos (PDF §14): los filtros de la pantalla coinciden con la API y con la fuente,
   y cada sismo muestra su procedencia con enlace al USGS. */

const DESDE = "2025-03-01";
const HASTA = "2025-10-31";
const MAG_MIN = 5;
const UTC5_MS = 5 * 3600_000;

/** Límites del periodo personalizado: días completos en hora de Lima (UTC-5). */
function limites(): { inicio: number; fin: number } {
  return {
    inicio: Date.parse(`${DESDE}T00:00:00Z`) + UTC5_MS,
    fin: Date.parse(`${HASTA}T00:00:00Z`) + UTC5_MS + 24 * 3600_000,
  };
}

test("el total filtrado coincide con la API y con la muestra del USGS", async ({ page }) => {
  const { inicio, fin } = limites();
  // Cuenta independiente, directamente sobre el archivo de la fuente.
  const esperado = muestra().filter(
    (f) => f.properties.mag >= MAG_MIN && f.properties.time >= inicio && f.properties.time < fin,
  ).length;
  expect(esperado).toBeGreaterThan(0);

  await iniciarSesion(page, "analista");
  await page.goto(`/eventos?periodo=custom&desde=${DESDE}&hasta=${HASTA}&magnitudMin=${MAG_MIN}`);
  const resumen = page.getByText(/Mostrando \d+–\d+ de [\d.,\s]+ eventos/);
  await expect(resumen).toBeVisible();
  const enPantalla = Number((await resumen.innerText()).match(/de ([\d.,\s]+) eventos/)![1].replace(/\D/g, ""));

  const qs = new URLSearchParams({
    from: new Date(inicio).toISOString(),
    to: new Date(fin).toISOString(),
    mag_min: String(MAG_MIN),
    page_size: "1",
  });
  const api = await page.request.get(`/api/v1/events?${qs}`);
  expect(api.ok()).toBeTruthy();
  const { total } = (await api.json()) as { total: number };

  expect(enPantalla).toBe(esperado);
  expect(total).toBe(esperado);
});

test("el detalle de un sismo muestra magnitud, profundidad y enlace a la fuente", async ({ page }) => {
  await iniciarSesion(page, "analista");
  await page.goto(`/eventos?periodo=custom&desde=2025-01-01&hasta=2025-12-31&magnitudMin=6`);
  const fila = page.locator("table tbody tr").first();
  await expect(fila).toBeVisible();
  await fila.click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(/km/).first()).toBeVisible();
  await dialogo.getByText("Procedencia y datos técnicos").click();
  const enlace = dialogo.locator('a[href*="earthquake.usgs.gov"]').first();
  await expect(enlace).toBeVisible();
  const href = (await enlace.getAttribute("href")) ?? "";
  expect(muestra().some((f) => href.includes(f.id))).toBeTruthy();
});
