import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { iniciarSesion } from "./ayuda";

/* Accesibilidad (PDF §13: contraste, teclado, etiquetas en formularios, tablas usables).
   axe-core revisa cada pantalla con las reglas WCAG 2.1 A/AA. La prueba falla con
   cualquier problema "critical" o "serious". Con A11Y_INFORME=1 imprime el detalle. */

const PANTALLAS: [string, string][] = [
  ["Dashboard", "/"],
  ["Eventos", "/eventos?periodo=custom&desde=2025-01-01&hasta=2025-12-31"],
  ["Mapa", "/mapa-sismico?periodo=custom&desde=2025-01-01&hasta=2025-12-31"],
  ["Análisis", "/analisis?periodo=custom&desde=2025-01-01&hasta=2025-12-31"],
  ["Preparación de datos", "/preparacion-datos"],
  ["Modelos ML", "/modelos-ml"],
  ["Estimaciones", "/estimaciones"],
  ["Reglas de alertas", "/reglas-alertas"],
  ["Centro de alertas", "/alertas"],
  ["Fuentes de datos", "/fuentes-datos"],
  ["Reportes", "/reportes"],
  ["Usuarios", "/usuarios"],
  ["Auditoría", "/auditoria"],
  ["Configuración", "/configuracion"],
];

const GRAVES = new Set(["critical", "serious"]);

async function revisar(page: Page, nombre: string) {
  // Espera a que terminen las cargas para revisar la pantalla con datos.
  await page.waitForLoadState("networkidle");
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = resultado.violations.filter((v) => GRAVES.has(v.impact ?? ""));
  if (process.env.A11Y_INFORME) {
    for (const v of resultado.violations) {
      console.log(`[${nombre}] ${v.impact} ${v.id} (${v.nodes.length}): ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(" ")} :: ${n.failureSummary?.split("\n")[1] ?? ""}`);
    }
  }
  return graves.map((v) => `${v.id} ×${v.nodes.length}: ${v.help} → ${v.nodes[0]?.target.join(" ")}`);
}

test("la pantalla de acceso no tiene problemas graves de accesibilidad", async ({ page }) => {
  await page.goto("/login");
  expect(await revisar(page, "Acceso")).toEqual([]);
});

test("las pantallas principales no tienen problemas graves de accesibilidad", async ({ page }) => {
  test.setTimeout(180_000);
  await iniciarSesion(page, "admin");
  const problemas: string[] = [];
  for (const [nombre, ruta] of PANTALLAS) {
    await page.goto(ruta);
    for (const p of await revisar(page, nombre)) problemas.push(`${nombre}: ${p}`);
  }
  expect(problemas).toEqual([]);
});

test("el acceso se puede completar solo con teclado", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").focus();
  await expect(page.locator("#email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#password")).toBeFocused();
});

test("un diálogo se cierra con Esc y devuelve el foco", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto("/reglas-alertas");
  const boton = page.getByRole("button", { name: "Nueva regla" });
  await boton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(boton).toBeFocused();
});
