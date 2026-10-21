import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Pruebas E2E de los flujos principales (ver e2e/README.md).
   Levanta su propia API (puerto 8010) y su propio Vite (5180) contra una base
   aparte que se recrea en cada ejecución (POSTGRES_DB terminada en _e2e). No
   toca la base ni los servidores de desarrollo. */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
const API_DIR = path.join(RAIZ, "services", "api");

// Contraseña de las cuentas de prueba: aleatoria por ejecución. Este archivo se
// evalúa también en cada worker, que hereda la variable ya fijada.
process.env.E2E_PASSWORD ??= `E2e#${randomBytes(12).toString("hex")}`;
process.env.POSTGRES_DB ??= "sismo_e2e";

const PYTHON =
  process.env.E2E_PYTHON ??
  (process.platform === "win32" ? path.join(API_DIR, ".venv", "Scripts", "python.exe") : "python");

const PUERTO_API = 8010;
const PUERTO_WEB = 5180;

const entornoApi = {
  ...process.env,
  ENV: "test",
  PYTHONIOENCODING: "utf-8",
} as Record<string, string>;

export default defineConfig({
  testDir: "./e2e",
  // Los flujos comparten una base: en serie, en el orden de los archivos.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    viewport: { width: 1366, height: 860 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 860 },
        // En Windows se usa Edge (viene con el sistema); en CI/Linux, el Chromium de Playwright.
        channel: process.env.E2E_CANAL ?? (process.platform === "win32" ? "msedge" : undefined),
      },
    },
  ],
  webServer: [
    {
      // Prepara la base desde cero y luego arranca la API.
      command: `"${PYTHON}" ../../tests/e2e/preparar.py && "${PYTHON}" -m uvicorn app.main:app --port ${PUERTO_API}`,
      cwd: API_DIR,
      env: entornoApi,
      url: `http://127.0.0.1:${PUERTO_API}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: process.env.CI ? "pipe" : "ignore",
    },
    {
      command: `npx vite --port ${PUERTO_WEB} --strictPort`,
      env: { ...process.env, VITE_API_PROXY_TARGET: `http://127.0.0.1:${PUERTO_API}` } as Record<string, string>,
      url: `http://localhost:${PUERTO_WEB}`,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});

export { PYTHON, RAIZ };
