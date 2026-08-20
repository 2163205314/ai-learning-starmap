FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ openjdk-17-jdk-headless util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 10001 runner \
    && adduser --system --uid 10001 --gid 10001 --home /tmp --no-create-home runner

WORKDIR /runner
COPY --chown=runner:runner runner_server.py ./runner_server.py

USER runner
EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/health', timeout=2)" || exit 1

CMD ["python", "-I", "/runner/runner_server.py"]
