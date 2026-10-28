# Demostración en línea (Render, un día)

Cómo publicar la plataforma en internet **por un día** para mostrarla (p. ej. al docente),
con datos reales del USGS y sismos **ficticios** generados en vivo. Gratis, sin tarjeta.
No es el despliegue de producción (ese es `infra/prod`, `docs/DESPLIEGUE.md`). El porqué
del diseño está en `docs/DECISIONES.md` D28 y D29.

```
Navegador ──HTTPS──► Render: servicio "sismo-demo" (API FastAPI que también sirve la web)
                                   │ SSL
                                   └──► PostgreSQL: base "sismo_db" (aparte, en una instancia existente)
PC del equipo ──SSL──► misma base (solo para crearla y la carga inicial: sismos y cuentas)
```

## Qué cambia frente a producción

| Producción (`infra/prod`) | Demo en Render |
|---|---|
| Caddy + web + API + worker + beat + Redis + copias | Un solo servicio (API sirve la web) + base |
| Sincronización automática cada 15 min (worker + beat) | Automática cada 15 min **dentro de la API** (`SYNC_EN_PROCESO`, D33) |
| Sismos solo reales | Reales **más** ficticios del simulador, marcados `[SIMULADO]` |
| Copias diarias | Ninguna (el estado *Copias de seguridad* lo indica) |
| Siempre encendido | Se dormiría a los 15 min sin visitas: el workflow **Demo despierta** la visita cada 5 min |

## 1. La base de datos (~5 min)

El plan gratuito de Render admite **una sola** base PostgreSQL por cuenta, así que el
Blueprint no crea la suya: usa una base `sismo_db` **aparte** dentro de una instancia que
ya exista en la cuenta (en la nuestra, `salesia-db`). Cada base de una instancia tiene sus
propias tablas: la demo no ve ni toca las de la otra aplicación. Comparten el límite de
1 GB (la demo usa ~20 MB) y el vencimiento de la instancia gratuita (30 días desde que se
creó).

1. Render → la instancia (`salesia-db`) → **Connections** → copiar **External Database
   URL** (`postgresql://USUARIO:CLAVE@HOST/BASE`). No la pegue en chats ni en el repo:
   contiene la contraseña.
2. Crear la base de la demo desde el PC (PowerShell, con el PostgreSQL local instalado):

   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "<External Database URL>" -c "CREATE DATABASE sismo_db;"
   ```

   Debe responder `CREATE DATABASE`. De la URL salen los valores de los pasos siguientes:
   `USUARIO`, `CLAVE`, `HOST` (termina en `render.com`) y el puerto `5432`. La base es
   `sismo_db`, no la que trae la URL.

Si la cuenta no tiene ninguna instancia, Render la crea gratis (*New → Postgres → Free*)
y se sigue igual. Otra opción es una base gratuita de Neon (neon.tech): sus datos de
conexión se usan de la misma forma.

## 2. El servicio (~15 min)

1. **Código en `main`** con `render.yaml`.
2. **Cuenta en Render** con **GitHub**, con acceso a la organización `Grupo-04-Senati`.
3. **Blueprint**: **New → Blueprint** → `Monitoreo-Sismico` → rama `main`. Render pide
   las variables manuales; completar:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_HOST` | `HOST` de la URL externa |
   | `POSTGRES_PORT` | `5432` |
   | `POSTGRES_USER` | `USUARIO` de la URL |
   | `POSTGRES_PASSWORD` | `CLAVE` de la URL |
   | `POSTGRES_DB` | `sismo_db` |

   → **Deploy Blueprint**. La construcción tarda ~5–10 min. Al arrancar aplica las
   migraciones en `sismo_db` (en *Logs*: `Running upgrade ... -> 0018_revisiones` y
   `Uvicorn running`).
4. **Comprobar**: `https://<dirección>/health` → `{"status":"ok"}`, y la dirección
   principal → pantalla de acceso. Suele ser `https://sismo-demo.onrender.com`; si el
   nombre estaba tomado, Render añade un sufijo y no hay que cambiar nada.

## 3. Cargar los datos desde el PC (~10 min)

En PowerShell, desde `services/api` y con el entorno virtual:

```powershell
$env:POSTGRES_HOST="<HOST>"          # p. ej. dpg-xxxx-a.oregon-postgres.render.com
$env:POSTGRES_PORT="5432"
$env:POSTGRES_USER="<USUARIO>"
$env:POSTGRES_PASSWORD="<CLAVE>"
$env:POSTGRES_DB="sismo_db"
$env:POSTGRES_SSL="true"
$env:DEMO_PASSWORD="<contraseña de las cuentas de demo>"   # 8+, con número y símbolo

.venv\Scripts\python -m alembic upgrade head                                  # ya hecho al arrancar; no hace daño
.venv\Scripts\python -m app.scripts.sincronizar --fuente usgs --desde 2000-01-01   # catálogo real (~7 600 sismos)
.venv\Scripts\python -m app.scripts.preparar_demo cuentas                     # una cuenta por rol
.venv\Scripts\python -m app.scripts.preparar_demo estado                      # qué falta para el guion
```

Estas variables valen solo para esa ventana de PowerShell: al cerrarla, el PC vuelve a su
base local (`services/api/.env`). La contraseña de las cuentas no se guarda en el repo.

## 4. El día de la demostración

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

### Sincronización automática y servicio despierto (D33)

- La API trae lo nuevo del USGS **sola cada 15 minutos** (`SYNC_EN_PROCESO=true` en Render):
  un sismo real que cumpla una regla activa genera su aviso sin que nadie pulse nada.
- El workflow de GitHub **Demo despierta** (`.github/workflows/demo-despierta.yml`) visita
  la demo cada 5 minutos para que Render no la duerma. Está en la pestaña *Actions*; se
  puede lanzar a mano (*Run workflow*) y apagar al terminar la semana.
- Mantenerla despierta consume horas del plan gratuito (750 h al mes por cuenta,
  compartidas con otros servicios gratuitos, como salesia-api): una semana son ~170 h.
- Configuración → *Entorno del servidor* → "Sincronización automática" lo confirma.

### SMS al celular (opcional, Twilio)

Sin configurar nada, el canal SMS funciona en **modo simulado**: el código de verificación
aparece en pantalla y las entregas quedan *Simulada*. Para que el SMS llegue de verdad:

1. Cuenta gratuita en twilio.com (plan *Limited trial*, sin tarjeta): obtener el número de
   prueba y verificar en *Verified Caller IDs* los celulares que recibirán (hasta 5, +51…).
   Si no llegan, marcar **Peru** en *Messaging → Settings → Geo permissions*.
2. Render → `sismo-demo` → **Environment** → agregar `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN` (secreto) y `TWILIO_FROM_NUMBER` (+1…) → *Save, rebuild, and deploy*.
3. Cada persona: **Mi perfil** (clic en su nombre, arriba a la derecha) → celular +
   consentimiento → código por SMS → **Verificar**.
4. Una regla con **SMS al celular** y los roles que lo reciben; al aprobar un aviso, llega
   el SMS. Configuración → *Entorno del servidor* muestra si Twilio está configurado.

Un número no verificado en la cuenta de prueba queda como entrega *Fallida* con el motivo.

## 5. Qué explicar

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

## 6. Si algo falla

| Síntoma | Causa y solución |
|---|---|
| La página tarda ~1 min | El servidor dormía. Normal en el plan gratuito |
| El build falla en Render | Ver *Logs* del servicio. El CI (trabajo `render`) construye la misma imagen en cada PR |
| "No se pudo conectar" al cargar datos | Revisar `POSTGRES_SSL=true` y que el host sea el **externo** |
| Blueprint: "cannot have more than one active free tier database" | Versión vieja del `render.yaml`: el actual no crea base (paso 1) |
| `permission denied to create database` | Usar una base gratuita de Neon (paso 1) |
| El simulador no aparece | Debe entrar como Administrador y el servicio tener `DEMO_SIMULACION=true` |
| Simular no genera avisos | Ninguna regla **activa** cubre la zona o la magnitud |
| *Ingesta* en Atención | El servicio estuvo dormido (el workflow *Demo despierta* falló o está apagado): *Sincronizar ahora* en Fuentes de datos y revisar la pestaña Actions de GitHub |
| Se olvidó la contraseña de demo | Repetir `preparar_demo cuentas` con otra `DEMO_PASSWORD` (paso 3) |

## 7. Después

0. GitHub → pestaña **Actions** → *Demo despierta* → **...** → **Disable workflow** (deja de
   visitar la demo).

1. Render → **Blueprints** → `sismora-demo` → *Settings* → borrar el Blueprint, y el
   servicio `sismo-demo` → *Settings* → **Delete Web Service**.
2. Borrar **solo** la base de la demo (no la instancia, que es de otra aplicación):

   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "<External Database URL>" -c "DROP DATABASE sismo_db;"
   ```

Así no queda nada publicado ni datos de la demo.
