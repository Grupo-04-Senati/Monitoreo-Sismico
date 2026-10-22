# Imagen de demostración para Render (un solo servicio, D29): compila la web y la sirve
# la propia API desde el mismo dominio (cookies de sesión sin CORS ni proxys externos).
# Para producción en servidor propio se usa infra/prod (Caddy + API separadas).

FROM node:20-alpine AS web
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/web/ apps/web/
RUN npm run build:web

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ML_ARTIFACTS_DIR=/data/ml-artifacts \
    SISMORA_REPORTS_DIR=/data/reports \
    WEB_DIST_DIR=/srv/www

RUN useradd --create-home --uid 10001 sismo
WORKDIR /srv/services/api
COPY services/api/requirements.txt .
RUN pip install -r requirements.txt

COPY services/api/ /srv/services/api/
COPY services/ingestion/ /srv/services/ingestion/
COPY services/ml/ /srv/services/ml/
COPY infra/prod/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
COPY --from=web /repo/apps/web/dist /srv/www

RUN chmod 0755 /usr/local/bin/api-entrypoint.sh \
    && mkdir -p /data/ml-artifacts /data/reports \
    && chown -R sismo:sismo /data

USER sismo
# Render indica el puerto en $PORT (el entrypoint lo usa; 8000 si no existe).
EXPOSE 8000
ENTRYPOINT ["api-entrypoint.sh"]
CMD ["api"]
