# Pruebas E2E (Playwright)

Flujos principales con un navegador real contra la API y la web de verdad.

## Qué prueban

| Archivo | Flujo |
|---|---|
| `01-acceso.spec.ts` | Redirección sin sesión, contraseña incorrecta, entrada y salida |
| `02-roles.spec.ts` | Analista y Operador: menú, "Acceso denegado" y 403 de la API |
| `03-eventos.spec.ts` | Total filtrado = API = archivo del USGS; detalle con enlace a la fuente |
| `04-alertas.spec.ts` | Crear y simular regla, solo el Administrador activa, avisos sin duplicar, aprobar y ver la entrega, Auditoría |
| `05-configuracion.spec.ts` | Estado del sistema y control de cambios de un parámetro |
| `06-accesibilidad.spec.ts` | axe-core (WCAG 2.1 A/AA) en el acceso y 14 pantallas; teclado y Esc en diálogos. Con `A11Y_INFORME=1` imprime cada hallazgo |

## Cómo funcionan

- Cada ejecución **borra y recrea** la base `sismo_e2e` (`tests/e2e/preparar.py`); el script
  se niega a tocar una base cuyo nombre no termine en `_e2e`. Tu base de desarrollo no se toca.
- Carga la muestra real del USGS (`tests/fixtures/usgs_peru_2025_m45.json`) con el motor de
  ingesta y crea tres cuentas de prueba con una contraseña **aleatoria por ejecución**.
- Levanta su propia API (puerto 8010) y su propio Vite (5180): pueden correr con los
  servidores de desarrollo encendidos.
- En Windows usa Microsoft Edge; en el CI, el Chromium de Playwright.

## Ejecutar

Requisitos: PostgreSQL local y `services/api/.env` con sus credenciales (el usuario debe
poder crear bases), el entorno virtual de la API y `npm ci` hecho.

```bash
cd apps/web
npm run e2e
```

En Linux/macOS, si la API no usa `python` del sistema, indique el intérprete con
`E2E_PYTHON=../../services/api/.venv/bin/python npm run e2e`.

Si una prueba falla, Playwright guarda la captura y la traza en `apps/web/test-results/`
(`npx playwright show-trace <archivo>.zip`).
