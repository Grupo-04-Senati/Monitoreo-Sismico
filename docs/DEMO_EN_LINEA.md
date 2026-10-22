# Demostración en línea (Render, un día)

Cómo publicar la plataforma en internet **por un día** para mostrarla (p. ej. al docente),
con datos reales del USGS y sismos **ficticios** generados en vivo. Gratis, sin tarjeta.
No es el despliegue de producción (ese es `infra/prod`, `docs/DESPLIEGUE.md`). El porqué
del diseño está en `docs/DECISIONES.md` D28 y D29.

```
Navegador ──HTTPS──► Render: servicio "sismo-demo" (API FastAPI que también sirve la web)
                                   │
                                   └──► Render: PostgreSQL "sismo-demo-db"
PC del equipo ──SSL──► misma base (solo para la carga inicial: sismos y cuentas)
```

## Qué cambia frente a producción

| Producción (`infra/prod`) | Demo en Render |
|---|---|
| Caddy + web + API + worker + beat + Redis + copias | Un solo servicio (API sirve la web) + base |
| Sincronización automática cada 15 min | Solo manual (Fuentes de datos → *Sincronización manual*) |
| Sismos solo reales | Reales **más** ficticios del simulador, marcados `[SIMULADO]` |
| Copias diarias | Ninguna (el estado *Copias de seguridad* lo indica) |
| Siempre encendido | Se duerme a los 15 min sin uso; despierta en ~1 min |

## 1. Preparar (una vez, ~30 min)

1. **Código en `main`**: la rama con `render.yaml` debe estar fusionada.
2. **Cuenta en Render**: <https://render.com> → *Get Started* → entrar con **GitHub**.
   El repositorio es de la organización `Grupo-04-Senati`: al conectar GitHub, dar acceso
   a esa organización (o a ese repositorio). Si no aparece, un dueño de la organización
   debe aprobar la app de Render.
3. **Blueprint**: en Render → **New → Blueprint** → elegir `Monitoreo-Sismico` → rama
   `main` → **Apply**. Crea la base `sismo-demo-db` y el servicio `sismo-demo`. La primera
   construcción tarda ~5–10 min (compila la web y la imagen). Al terminar, el servicio
   muestra su dirección, normalmente `https://sismo-demo.onrender.com` (si el nombre ya
   estaba tomado, Render añade un sufijo; no hace falta cambiar nada).
4. **Comprobar**: abrir `https://<dirección>/health` → `{"status":"ok"}`, y la dirección
   principal → pantalla de acceso. Al arrancar, el servicio aplica las migraciones.

## 2. Cargar los datos desde el PC (~10 min)

El plan gratuito no tiene consola, así que los datos se cargan desde el PC del equipo
contra la base de Render. En Render → `sismo-demo-db` → **Connections** → *External
Database URL*. Tiene la forma `postgresql://USUARIO:CLAVE@HOST/BASE`; de ahí salen los
valores (el host termina en `render.com`).

En PowerShell, desde `services/api` y con el entorno virtual:

```powershell
$env:POSTGRES_HOST="<HOST>"          # p. ej. dpg-xxxx-a.oregon-postgres.render.com
$env:POSTGRES_PORT="5432"
$env:POSTGRES_USER="<USUARIO>"
$env:POSTGRES_PASSWORD="<CLAVE>"
$env:POSTGRES_DB="<BASE>"
$env:POSTGRES_SSL="true"
$env:DEMO_PASSWORD="<contraseña de las cuentas de demo>"   # 8+, con número y símbolo

.venv\Scripts\python -m alembic upgrade head                                  # ya hecho al arrancar; no hace daño
.venv\Scripts\python -m app.scripts.sincronizar --fuente usgs --desde 2000-01-01   # catálogo real (~7 600 sismos)
.venv\Scripts\python -m app.scripts.preparar_demo cuentas                     # una cuenta por rol
.venv\Scripts\python -m app.scripts.preparar_demo estado                      # qué falta para el guion
```

Estas variables valen solo para esa ventana de PowerShell: al cerrarla, el PC vuelve a su
base local (`services/api/.env`). La contraseña de las cuentas no se guarda en el repo.

## 3. El día de la demostración

1. **1–2 minutos antes**, abrir la dirección para despertar el servidor.
2. Seguir `docs/GUION_DEMO.md` con las cuentas `demo-<rol>@empresa-ejemplo.pe`.
3. Para mostrar la cadena completa en vivo usar el **Simulador de sismos** (abajo).

### Simulador de sismos (Configuración, Administrador)

Solo existe en esta demo (`DEMO_SIMULACION=true`). Se elige la zona (Mina Arequipa, costa
de Lima, mar frente a Ica, Tacna o Cusco), la magnitud y si trae réplicas → **Simular
sismo**. Cada sismo ficticio:

1. entra como una **ejecución de ingesta** propia (Fuentes de datos la registra);
2. recibe su **departamento** por coordenadas, igual que uno del USGS;
3. se evalúa contra las **reglas activas** y, si alguna lo cubre, genera un **aviso**
   pendiente de aprobación (Centro de alertas);
4. queda en la **Auditoría** (*sismo_simulado*).

Siempre se distingue de los reales: su lugar empieza con `[SIMULADO]` y su fuente es
"Simulador de demostración (datos ficticios)". Ejemplo: activar la regla del paso 7 del
guion (*Mina Arequipa M4.5, 300 km*) y simular un M5.2 con 2 réplicas en Mina Arequipa →
3 sismos y avisos en el Centro de alertas.

## 4. Qué explicar

**Uso empresarial.** Una minera, eléctrica o constructora con activos en zonas sísmicas
necesita saber en minutos si un sismo ocurrió cerca de sus instalaciones, decidir quién
avisa a quién y dejar constancia. La plataforma:

- reúne los sismos publicados por una fuente confiable (USGS) sin duplicarlos y aplica sus
  correcciones posteriores;
- traduce reglas de la empresa ("M≥4.5 a menos de 300 km de la mina") en **avisos
  internos** con aprobación, entrega y acuse de recibo;
- separa responsabilidades por **rol** (analista, operador, auditor…) y registra todo en
  una auditoría inalterable;
- ofrece **estimaciones experimentales** de actividad (violeta, con su incertidumbre).

Nunca predice sismos ni reemplaza al IGP o INDECI.

**Técnico.**

- Frontend React + TypeScript (Vite, Tailwind). Backend FastAPI asíncrono con PostgreSQL
  (SQLAlchemy, Alembic). Ingesta propia del USGS con idempotencia y revisiones. ML con
  scikit-learn y datasets congelados.
- Seguridad: autorización en el backend por rol, sesión en cookie HttpOnly, CSP, límite de
  intentos de acceso, secretos solo en variables de entorno.
- Calidad: más de 400 pruebas automáticas del backend, 18 E2E con accesibilidad, CI que
  construye y prueba también esta imagen de Render en cada cambio.

## 5. Si algo falla

| Síntoma | Causa y solución |
|---|---|
| La página tarda ~1 min | El servidor dormía. Normal en el plan gratuito |
| El build falla en Render | Ver *Logs* del servicio. El CI (trabajo `render`) construye la misma imagen en cada PR |
| "No se pudo conectar" al cargar datos | Revisar `POSTGRES_SSL=true` y que el host sea el **externo** |
| El simulador no aparece | Debe entrar como Administrador y el servicio tener `DEMO_SIMULACION=true` |
| Simular no genera avisos | Ninguna regla **activa** cubre la zona o la magnitud |
| *Ingesta* en Atención | No hay sincronización automática: *Sincronización manual* en Fuentes de datos |
| Se olvidó la contraseña de demo | Repetir `preparar_demo cuentas` con otra `DEMO_PASSWORD` (paso 2) |

## 6. Después

Render → `sismo-demo` → *Settings* → **Delete Web Service**, y `sismo-demo-db` →
**Delete Database**. Así no queda nada publicado. La base gratuita vence sola a los 30 días.
