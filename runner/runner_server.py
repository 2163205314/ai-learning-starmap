"""Standalone local/container code runner. Never import this into the Django web process."""

import hmac
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


EXECUTION_MODE = os.environ.get("RUNNER_EXECUTION_MODE", "local").strip().lower()
HOST = os.environ.get("RUNNER_HOST", "0.0.0.0" if EXECUTION_MODE == "docker" else "127.0.0.1")
PORT = int(os.environ.get("RUNNER_PORT", "8081" if EXECUTION_MODE == "docker" else "8765"))
SHARED_TOKEN = os.environ.get("RUNNER_SHARED_TOKEN", "")
MAX_SOURCE_BYTES = 32 * 1024
MAX_REQUEST_BYTES = MAX_SOURCE_BYTES * 4 + 4096
MAX_OUTPUT_BYTES = 64 * 1024
OUTPUT_FILE_LIMIT = 128 * 1024
RUN_TIMEOUT_SECONDS = 3
COMPILE_TIMEOUT_SECONDS = 8
RUN_SLOTS = threading.BoundedSemaphore(int(os.environ.get("RUNNER_MAX_CONCURRENCY", "2")))
PROGRAM_NAME = "program.exe" if os.name == "nt" else "program"
PROGRAM_COMMAND = [PROGRAM_NAME] if os.name == "nt" else ["./program"]
PRLIMIT = shutil.which("prlimit")


LANGUAGES = {
    "python": {"filename": "main.py", "run": [sys.executable, "-I", "-S", "main.py"]},
    "c": {
        "filename": "main.c",
        "compile": ["gcc", "-std=c17", "-O0", "-pipe", "main.c", "-o", PROGRAM_NAME],
        "run": PROGRAM_COMMAND,
    },
    "cpp": {
        "filename": "main.cpp",
        "compile": ["g++", "-std=c++20", "-O0", "-pipe", "main.cpp", "-o", PROGRAM_NAME],
        "run": PROGRAM_COMMAND,
    },
    "java": {
        "filename": "Main.java",
        "compile": ["javac", "-encoding", "UTF-8", "Main.java"],
        "run": [
            "java",
            "-Xms16m",
            "-Xmx96m",
            "-XX:MaxMetaspaceSize=96m",
            "-XX:ActiveProcessorCount=1",
            "-cp",
            ".",
            "Main",
        ],
    },
}


def safe_environment(temp_dir):
    allowed = ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT"]
    environment = {name: os.environ[name] for name in allowed if os.environ.get(name)}
    environment.update({"HOME": temp_dir, "TMP": temp_dir, "TEMP": temp_dir, "LANG": "C.UTF-8"})
    return environment


def limited_command(command, memory_bytes=None):
    if not PRLIMIT:
        return command
    limits = [
        PRLIMIT,
        "--cpu=2",
        f"--fsize={OUTPUT_FILE_LIMIT}",
        "--nofile=32",
        "--nproc=32",
        "--core=0",
    ]
    if memory_bytes:
        limits.append(f"--as={memory_bytes}")
    return [*limits, "--", *command]


def command_available(command, cwd, environment):
    executable = command[0]
    if (Path(cwd) / executable).exists():
        return True
    if executable.startswith(".") or Path(executable).is_absolute():
        return (Path(cwd) / executable).resolve().exists() if not Path(executable).is_absolute() else Path(executable).exists()
    return shutil.which(executable, path=environment.get("PATH")) is not None


def read_output(path):
    size = path.stat().st_size
    content = path.read_bytes()[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")
    if size > MAX_OUTPUT_BYTES:
        content += "\n[output truncated]"
    return content


def terminate_process_tree(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2,
            check=False,
        )
    else:
        os.killpg(process.pid, signal.SIGKILL)


def run_command(command, cwd, timeout, memory_bytes=None):
    stdout_path = Path(cwd) / ".stdout"
    stderr_path = Path(cwd) / ".stderr"
    environment = safe_environment(str(cwd))
    if not command_available(command, cwd, environment):
        return {
            "exitCode": 127,
            "stdout": "",
            "stderr": f"ToolchainError: 找不到命令 {command[0]}，请先在本机安装并加入 PATH。",
            "timedOut": False,
            "outputLimited": False,
            "toolchainMissing": command[0],
            "duration": 1,
        }

    started_at = time.monotonic()
    timed_out = False
    output_limited = False
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW

    with stdout_path.open("wb") as stdout_file, stderr_path.open("wb") as stderr_file:
        process = subprocess.Popen(
            limited_command(command, memory_bytes),
            cwd=cwd,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=stdout_file,
            stderr=stderr_file,
            start_new_session=os.name != "nt",
            creationflags=creation_flags,
        )
        deadline = time.monotonic() + timeout
        while process.poll() is None:
            if time.monotonic() >= deadline:
                timed_out = True
                terminate_process_tree(process)
                break
            stdout_file.flush()
            stderr_file.flush()
            if stdout_path.stat().st_size > OUTPUT_FILE_LIMIT or stderr_path.stat().st_size > OUTPUT_FILE_LIMIT:
                output_limited = True
                terminate_process_tree(process)
                break
            time.sleep(0.025)
        exit_code = process.wait()

    return {
        "exitCode": exit_code,
        "stdout": read_output(stdout_path),
        "stderr": read_output(stderr_path),
        "timedOut": timed_out,
        "outputLimited": output_limited,
        "duration": max(1, round((time.monotonic() - started_at) * 1000)),
    }


def execute(language, source):
    config = LANGUAGES[language]
    started_at = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="atlas-run-") as temp_dir:
        source_path = Path(temp_dir) / config["filename"]
        source_path.write_text(source, encoding="utf-8")

        if "compile" in config:
            compile_result = run_command(config["compile"], temp_dir, COMPILE_TIMEOUT_SECONDS)
            if compile_result["timedOut"] or compile_result["exitCode"] != 0:
                return {"ok": False, "phase": "compile", "executionMode": EXECUTION_MODE, **compile_result}

        memory_limit = None if language == "java" else 256 * 1024 * 1024
        run_result = run_command(config["run"], temp_dir, RUN_TIMEOUT_SECONDS, memory_limit)
        run_result["duration"] = max(1, round((time.monotonic() - started_at) * 1000))
        return {
            "ok": not run_result["timedOut"] and not run_result["outputLimited"] and run_result["exitCode"] == 0,
            "phase": "run",
            "executionMode": EXECUTION_MODE,
            **run_result,
        }


def toolchain_status():
    environment = safe_environment(tempfile.gettempdir())
    return {
        "python": True,
        "c": shutil.which("gcc", path=environment.get("PATH")) is not None,
        "cpp": shutil.which("g++", path=environment.get("PATH")) is not None,
        "java": all(shutil.which(command, path=environment.get("PATH")) is not None for command in ["java", "javac"]),
    }


class RunnerHandler(BaseHTTPRequestHandler):
    server_version = "AtlasRunner/2"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            authenticated = bool(
                SHARED_TOKEN and hmac.compare_digest(self.headers.get("X-Runner-Token", ""), SHARED_TOKEN)
            )
            self.send_json(
                200,
                {
                    "ok": True,
                    "languages": sorted(LANGUAGES),
                    "executionMode": EXECUTION_MODE,
                    "toolchains": toolchain_status(),
                    "isolation": "container" if EXECUTION_MODE == "docker" else "local-process",
                    "authenticated": authenticated,
                },
            )
            return
        self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/run":
            self.send_json(404, {"error": "not_found"})
            return
        if not SHARED_TOKEN or not hmac.compare_digest(self.headers.get("X-Runner-Token", ""), SHARED_TOKEN):
            self.send_json(403, {"error": "forbidden"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "invalid_content_length"})
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_json(413, {"error": "payload_too_large"})
            return
        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "invalid_json"})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"error": "invalid_request"})
            return
        language = payload.get("language")
        source = payload.get("source")
        if language not in LANGUAGES or not isinstance(source, str) or not source.strip():
            self.send_json(400, {"error": "invalid_request"})
            return
        if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
            self.send_json(413, {"error": "source_too_large"})
            return
        if not RUN_SLOTS.acquire(blocking=False):
            self.send_json(429, {"error": "runner_busy"})
            return
        try:
            self.send_json(200, execute(language, source))
        except Exception as exc:
            print(f"runner internal error: {type(exc).__name__}", flush=True)
            self.send_json(500, {"error": "runner_internal_error"})
        finally:
            RUN_SLOTS.release()

    def log_message(self, message_format, *args):
        print(f"runner {self.client_address[0]} {message_format % args}", flush=True)


if __name__ == "__main__":
    if EXECUTION_MODE not in {"local", "docker"}:
        raise SystemExit("RUNNER_EXECUTION_MODE must be local or docker")
    if not SHARED_TOKEN:
        raise SystemExit("RUNNER_SHARED_TOKEN is required")
    server = ThreadingHTTPServer((HOST, PORT), RunnerHandler)
    server.daemon_threads = True
    print(f"Atlas runner ({EXECUTION_MODE}) listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()
