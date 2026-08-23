"""Loopback-only WebSocket bridge between Monaco and Pyright stdio.

The gateway never executes learner programs. It only forwards bounded JSON-RPC
messages to a language server running in a disposable workspace.
"""

import argparse
import asyncio
import json
import os
import shutil
import tempfile
from http import HTTPStatus
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from websockets.exceptions import ConnectionClosed
from websockets.legacy.server import serve


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766
MAX_WEBSOCKET_MESSAGE_BYTES = 1024 * 1024
MAX_LSP_MESSAGE_BYTES = 4 * 1024 * 1024
MAX_CONNECTIONS = 4
ALLOWED_ORIGIN_HOSTS = frozenset({"127.0.0.1", "localhost", "[::1]"})
SUPPORTED_LANGUAGE = "python"


def resolve_pyright_command():
    configured = os.environ.get("PYRIGHT_LANGSERVER", "").strip()
    if configured:
        return [configured, "--stdio"]

    local_server = ROOT / ".lsp" / "node_modules" / "pyright" / "langserver.index.js"
    node = shutil.which("node")
    if node and local_server.is_file():
        return [node, str(local_server), "--stdio"]

    executable = shutil.which("pyright-langserver")
    if executable:
        return [executable, "--stdio"]
    return None


def encode_lsp_message(payload):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body


async def read_lsp_message(stream):
    content_length = None
    while True:
        line = await stream.readline()
        if not line:
            raise EOFError("language server closed stdout")
        if line in {b"\r\n", b"\n"}:
            break
        name, separator, value = line.decode("ascii", errors="strict").partition(":")
        if separator and name.lower() == "content-length":
            content_length = int(value.strip())
    if content_length is None or not 0 <= content_length <= MAX_LSP_MESSAGE_BYTES:
        raise ValueError("invalid LSP content length")
    body = await stream.readexactly(content_length)
    return json.loads(body.decode("utf-8"))


def request_is_authorized(path, expected_token):
    query = parse_qs(urlparse(path).query)
    supplied = query.get("token", [""])[0]
    return bool(expected_token) and supplied == expected_token


def origin_is_allowed(origin):
    if not origin:
        return False
    parsed = urlparse(origin)
    return parsed.scheme in {"http", "https"} and parsed.hostname in ALLOWED_ORIGIN_HOSTS


async def discard_stderr(stream):
    while await stream.readline():
        pass


async def stop_process(process):
    if process.returncode is not None:
        return
    process.terminate()
    try:
        await asyncio.wait_for(process.wait(), timeout=3)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()


class Gateway:
    def __init__(self, token):
        self.token = token
        self.connection_slots = asyncio.Semaphore(MAX_CONNECTIONS)

    def process_request(self, path, _headers):
        parsed = urlparse(path)
        if parsed.path != "/health":
            return None
        if not request_is_authorized(path, self.token):
            body = b'{"ok":false,"error":"unauthorized"}'
            return HTTPStatus.UNAUTHORIZED, [("Content-Type", "application/json")], body
        payload = {
            "ok": True,
            "service": "lsp-gateway",
            "languages": {SUPPORTED_LANGUAGE: resolve_pyright_command() is not None},
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        return HTTPStatus.OK, [("Content-Type", "application/json"), ("Content-Length", str(len(body)))], body

    async def handle(self, websocket, path):
        parsed = urlparse(path)
        if parsed.path != f"/{SUPPORTED_LANGUAGE}" or not request_is_authorized(path, self.token):
            await websocket.close(code=1008, reason="unauthorized or unsupported language")
            return
        if not origin_is_allowed(websocket.request_headers.get("Origin")):
            await websocket.close(code=1008, reason="origin not allowed")
            return
        if self.connection_slots.locked():
            await websocket.close(code=1013, reason="language server capacity reached")
            return

        async with self.connection_slots:
            await self.bridge_python(websocket)

    async def bridge_python(self, websocket):
        command = resolve_pyright_command()
        if command is None:
            await websocket.send(json.dumps({"method": "gateway/error", "params": {"code": "pyright_missing", "message": "Pyright 未安装。"}}))
            await websocket.close(code=1011, reason="pyright unavailable")
            return

        with tempfile.TemporaryDirectory(prefix="starmap-lsp-") as workspace_value:
            workspace = Path(workspace_value).resolve()
            document = workspace / "solution.py"
            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=workspace,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                creationflags=getattr(__import__("subprocess"), "CREATE_NO_WINDOW", 0),
            )
            stderr_task = asyncio.create_task(discard_stderr(process.stderr))
            await websocket.send(
                json.dumps(
                    {
                        "method": "gateway/ready",
                        "params": {
                            "language": SUPPORTED_LANGUAGE,
                            "workspaceUri": workspace.as_uri(),
                            "documentUri": document.as_uri(),
                        },
                    }
                )
            )

            async def browser_to_server():
                async for raw_message in websocket:
                    if not isinstance(raw_message, str) or len(raw_message.encode("utf-8")) > MAX_WEBSOCKET_MESSAGE_BYTES:
                        raise ValueError("invalid WebSocket message")
                    payload = json.loads(raw_message)
                    if not isinstance(payload, dict):
                        raise ValueError("JSON-RPC payload must be an object")
                    process.stdin.write(encode_lsp_message(payload))
                    await process.stdin.drain()

            async def server_to_browser():
                while True:
                    payload = await read_lsp_message(process.stdout)
                    await websocket.send(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

            tasks = [asyncio.create_task(browser_to_server()), asyncio.create_task(server_to_browser())]
            try:
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    error = task.exception()
                    if error and not isinstance(error, (ConnectionClosed, EOFError, asyncio.IncompleteReadError)):
                        raise error
                for task in pending:
                    task.cancel()
            finally:
                for task in tasks:
                    task.cancel()
                stderr_task.cancel()
                await stop_process(process)


async def run_server(host, port, token):
    gateway = Gateway(token)
    async with serve(
        gateway.handle,
        host,
        port,
        process_request=gateway.process_request,
        max_size=MAX_WEBSOCKET_MESSAGE_BYTES,
        max_queue=16,
        ping_interval=20,
        ping_timeout=20,
    ):
        print(f"LSP gateway listening on ws://{host}:{port}", flush=True)
        await asyncio.Future()


def parse_args():
    parser = argparse.ArgumentParser(description="AI Learning Starmap local LSP gateway")
    parser.add_argument("--host", default=os.environ.get("LSP_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("LSP_PORT", DEFAULT_PORT)))
    return parser.parse_args()


def main():
    args = parse_args()
    token = os.environ.get("LSP_SHARED_TOKEN", "")
    if not token:
        raise SystemExit("LSP_SHARED_TOKEN is required")
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("LSP gateway must listen on loopback")
    asyncio.run(run_server(args.host, args.port, token))


if __name__ == "__main__":
    main()
