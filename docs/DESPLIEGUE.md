# Despliegue en producción y recuperación

Cómo instalar, actualizar, respaldar y recuperar la plataforma en un servidor propio
(decisión D22). Todo corre con Docker Compose desde `infra/prod/`.

## 1. Qué se levanta

| Servicio | Imagen | Función |
|---|---|---|
| `web` | Caddy + frontend compilado | HTTPS automático, sirve la web y reenvía `/api` y `/health` a la API |
| `api` | `infra/prod/Dockerfile.api` | Aplica migraciones al arrancar y sirve la API (sin `--reload`) |
| `worker` | misma imagen | Ejecuta las sincronizaciones (Celery) |
| `beat` | misma imagen | Programa la ingesta cada `INGESTION_INTERVAL_MINUTES` |
| `db` | `postgres:16-alpine` | Base de datos (sin puerto público) |
| `redis` | `redis:7-alpine` | Cola de Celery (sin puerto público) |
| `backup` | `postgres:16-alpine` | Copia diaria con `pg_dump` y retención |

Solo `web` publica puertos (80 y 443). La web y la API comparten dominio, por eso las
cookies de sesión pueden ser `Secure` y `SameSite` sin CORS entre dominios.

## 2. Requisitos del servidor

- Linux con Docker Engine y el plugin Docker Compose v2.
- Un dominio (p. ej. `sismo.empresa.pe`) cuyo DNS apunte al servidor.
- Puertos 80 y 443 abiertos (Let's Encrypt valida por el puerto 80).
- 2 vCPU, 4 GB de RAM y 20 GB de disco son suficientes para el catálogo actual.

## 3. Primera instalación

```bash
git clone https://github.com/Grupo-04-Senati/Monitoreo-Sismico.git
cd Monitoreo-Sismico
cp infra/prod/.env.prod.example infra/prod/.env.prod
```

Completar `infra/prod/.env.prod` (no se versiona):

- `SISMO_DOMINIO` y `CORS_ORIGINS` con el dominio real.
- `POSTGRES_PASSWORD`: `openssl rand -base64 32`.
- `API_SECRET_KEY`: `openssl rand -hex 32`.
- SMTP solo si se activará el correo de avisos.

Levantar:

```bash
docker compose -f infra/prod/docker-compose.yml --env-file infra/prod/.env.prod up -d --build
```

Si la configuración es insegura (clave de ejemplo, cookies sin `Secure`, CORS con
localhost…), la API **no arranca** y el motivo aparece en `logs api` (D21).

Crear la primera cuenta de Administrador (pide la contraseña sin mostrarla):

```bash
docker compose -f infra/prod/docker-compose.yml --env-file infra/prod/.env.prod \
  exec api python -m app.scripts.crear_admin --email admin@empresa.pe --name "Nombre Apellido"
```

Carga histórica inicial del catálogo (una vez; luego la ingesta es automática):

```bash
docker compose -f infra/prod/docker-compose.yml --env-file infra/prod/.env.prod \
  exec api python -m app.scripts.sincronizar --fuente usgs --desde 2000-01-01
```

Comprobar: `https://<dominio>/health` responde `{"status":"ok"}` y la web pide iniciar sesión.

## 4. Operación diaria

Atajo recomendado en el servidor:

```bash
alias sismo='docker compose -f infra/prod/docker-compose.yml --env-file infra/prod/.env.prod'
```

| Tarea | Comando |
|---|---|
| Estado de los servicios | `sismo ps` |
| Registros de la API | `sismo logs -f api` |
| Registros de la ingesta | `sismo logs -f worker beat` |
| Actualizar a la última versión | `git pull && sismo up -d --build` (migra solo) |
| Copia manual inmediata | `sismo exec backup sh /scripts/respaldar.sh` |
| Simulacro de restauración | `sismo exec backup sh /scripts/simulacro_restauracion.sh` |
| Reiniciar un servicio | `sismo restart api` |

Las copias quedan en `SISMO_BACKUP_DIR` (por defecto `infra/prod/backups/`), una por
día, y se borran las de más de `RETENCION_DIAS`. **Copie esa carpeta fuera del
servidor** (otro disco o almacenamiento externo): una copia en el mismo servidor no
protege contra la pérdida del servidor.

Se recomienda un simulacro de restauración al menos una vez al mes y siempre antes de
una actualización grande. El CI ya hace uno en cada cambio (D21, trabajo `despliegue`).

## 5. Recuperación

### 5.1 La API o la web no responden

1. `sismo ps` y `sismo logs --tail 100 api web`.
2. Si la API dice que "no arranca en producción", corregir `.env.prod` y `sismo up -d`.
3. Si la base no está sana: `sismo logs db`; revisar espacio en disco (`df -h`).

### 5.2 Volver a una versión anterior del código

```bash
git log --oneline -5          # elegir el commit estable
git checkout <commit>
sismo up -d --build
```

Si la versión nueva aplicó una migración que la anterior no conoce, restaurar la
copia previa a la actualización (5.3) en lugar de bajar migraciones a mano.

### 5.3 Restaurar la base desde una copia

1. Detener lo que escribe en la base: `sismo stop api worker beat`.
2. Renombrar la base dañada (se conserva por si hace falta revisarla):

   ```bash
   sismo exec db psql -U sismo -d postgres -c 'ALTER DATABASE sismo_db RENAME TO sismo_db_danada'
   ```

3. Restaurar la copia elegida con el nombre original:

   ```bash
   sismo exec backup sh /scripts/restaurar.sh /backups/<archivo>.dump sismo_db
   ```

4. Levantar de nuevo: `sismo start api worker beat`. La API aplica las migraciones que
   falten. Comprobar `/health`, iniciar sesión y revisar Auditoría.
5. Cuando todo esté verificado, borrar la base renombrada.

`restaurar.sh` nunca escribe sobre una base existente: si el nombre ya existe, se detiene.

### 5.4 Pérdida total del servidor

En un servidor nuevo: sección 3 sin la carga histórica, luego 5.3 con la última copia
guardada fuera del servidor. Lo que entre la última copia y la caída se pierde (hasta
24 h con la frecuencia por defecto); los sismos se recuperan solos con la siguiente
sincronización del USGS.

## 6. Límites conocidos

- Un proceso de API por defecto (`API_WORKERS=1`): el límite de intentos de acceso vive
  en memoria. Para escalar, mover ese contador a Redis antes de subir los procesos.
- Los modelos de ML y los reportes viven en volúmenes (`ml-artifacts`, `reports`) que la
  copia de PostgreSQL no incluye: los modelos se pueden reentrenar con el dataset y la
  semilla guardados; los reportes son temporales.
- Sin monitoreo externo todavía (Fase 9c): revisar `logs` y `/health`.
