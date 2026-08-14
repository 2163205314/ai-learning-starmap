FROM python:3.12-slim

ARG APP_UID=1000
ARG APP_GID=1000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DB_PATH=/app/data/db.sqlite3 \
    HOME=/home/django

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --gid "${APP_GID}" django \
    && adduser --uid "${APP_UID}" --gid "${APP_GID}" --disabled-password --gecos "" django

COPY requirements.txt ./
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

COPY --chown=django:django . .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint

RUN mkdir -p /app/data \
    && chmod 755 /usr/local/bin/docker-entrypoint \
    && chown -R django:django /app /home/django

USER django

VOLUME ["/app/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)" || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000", "--noreload"]
