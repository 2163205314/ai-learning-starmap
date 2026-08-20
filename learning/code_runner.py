"""Client for the separate local or Docker code runner process."""

import json
import time
import urllib.error
import urllib.request

from django.conf import settings
from django.core.cache import cache


SUPPORTED_LANGUAGES = frozenset({"python", "c", "cpp", "java"})
MAX_RESPONSE_BYTES = 256 * 1024


class RunnerServiceError(Exception):
    def __init__(self, message, *, status=503, code="runner_unavailable"):
        super().__init__(message)
        self.status = status
        self.code = code


def runner_health():
    if not settings.RUNNER_SERVICE_URL:
        return {"ok": False, "message": "代码 Runner 未配置。"}
    try:
        request = urllib.request.Request(
            f"{settings.RUNNER_SERVICE_URL}/health",
            headers={"X-Runner-Token": settings.RUNNER_SHARED_TOKEN},
        )
        with urllib.request.urlopen(request, timeout=2) as response:
            body = response.read(16 * 1024)
        payload = json.loads(body)
        return {
            "ok": bool(payload.get("ok")) and bool(payload.get("authenticated")),
            "languages": payload.get("languages", []),
            "executionMode": payload.get("executionMode"),
            "isolation": payload.get("isolation"),
            "toolchains": payload.get("toolchains", {}),
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
        return {"ok": False, "message": "代码 Runner 未连接。"}


def enforce_rate_limit(client_id):
    bucket = int(time.time() // 60)
    key = f"code-runner-rate:{client_id}:{bucket}"
    if cache.add(key, 1, timeout=70):
        count = 1
    else:
        count = cache.incr(key)
    if count > settings.RUNNER_REQUESTS_PER_MINUTE:
        raise RunnerServiceError("运行请求过于频繁，请稍后再试。", status=429, code="rate_limited")


def execute_code(language, source, client_id):
    enforce_rate_limit(client_id)
    if not settings.RUNNER_SERVICE_URL or not settings.RUNNER_SHARED_TOKEN:
        raise RunnerServiceError("代码 Runner 尚未启动，请检查 runner.config 并重新运行启动脚本。")

    payload = json.dumps({"language": language, "source": source}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.RUNNER_SERVICE_URL}/run",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Runner-Token": settings.RUNNER_SHARED_TOKEN,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise RunnerServiceError("Runner 正忙，请稍后重试。", status=429, code="runner_busy") from exc
        raise RunnerServiceError("Runner 拒绝了本次任务，请检查运行服务配置。") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RunnerServiceError("无法连接代码 Runner，请检查 runner.config 对应的本地进程或 Docker 容器。") from exc

    if len(body) > MAX_RESPONSE_BYTES:
        raise RunnerServiceError("Runner 返回的数据超过安全上限。", code="response_too_large")
    try:
        return json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RunnerServiceError("Runner 返回了无法解析的响应。", code="invalid_response") from exc
