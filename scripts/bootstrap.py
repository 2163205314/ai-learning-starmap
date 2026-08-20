import configparser
import json
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VENV_DIR = ROOT / ".venv"
IS_WINDOWS = os.name == "nt"
PYTHON = VENV_DIR / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
MODEL_REPO_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODEL_DIR = ROOT / "models" / "paraphrase-multilingual-MiniLM-L12-v2"
MODEL_DOWNLOAD_URL = f"https://huggingface.co/{MODEL_REPO_ID}"
MODEL_REQUIRED_FILES = ("config.json", "modules.json")
RUNNER_CONFIG_PATH = ROOT / "runner.config"
RUNNER_STATE_DIR = ROOT / ".runner"
LOCAL_RUNNER_PROCESS = None


def print_step(message):
    print(f"\n==> {message}")


def print_hint(message):
    print(f"提示: {message}")


def run(command, label, hints=None):
    print_step(label)
    print("执行:", " ".join(str(part) for part in command))
    try:
        result = subprocess.run(command, cwd=ROOT)
    except FileNotFoundError as exc:
        print(f"\n失败: {label}")
        print(f"找不到命令: {exc.filename}")
        if hints:
            for hint in hints:
                print_hint(hint)
        return False
    if result.returncode == 0:
        return True
    print(f"\n失败: {label}")
    if hints:
        for hint in hints:
            print_hint(hint)
    return False


def internet_available():
    try:
        socket.create_connection(("pypi.org", 443), timeout=5).close()
        return True
    except OSError:
        return False


def find_python():
    candidates = []
    if IS_WINDOWS:
        candidates.extend([["py", "-3.12"], ["python"], ["python3"]])
    else:
        candidates.extend([["python3.12"], ["python3"], ["python"]])
    for command in candidates:
        executable = shutil.which(command[0])
        if not executable:
            continue
        try:
            result = subprocess.run(command + ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"], capture_output=True, text=True)
        except OSError:
            continue
        if result.returncode == 0:
            version = result.stdout.strip()
            major, minor = [int(part) for part in version.split(".")[:2]]
            if (major, minor) >= (3, 12):
                return command
    return None


def create_venv(python_command):
    if PYTHON.exists():
        print_step("虚拟环境已存在")
        print(PYTHON)
        return True
    print_step("创建虚拟环境")
    ok = run(
        python_command + ["-m", "venv", str(VENV_DIR)],
        "使用系统 Python 创建虚拟环境",
        [
            "如果当前 Python 版本过低，请安装 Python 3.12 或更高版本。",
            "Windows 可从 https://www.python.org/downloads/ 安装，并勾选 Add python.exe to PATH。",
            "macOS 可用 Homebrew: brew install python@3.12。",
            "Ubuntu/Debian 可尝试: sudo apt install python3.12 python3.12-venv。",
        ],
    )
    if not ok:
        return False
    if not PYTHON.exists():
        print("虚拟环境创建后未找到预期的 Python。")
        print_hint(f"预期位置: {PYTHON}")
        print_hint("请删除 .venv 后重新运行启动脚本。")
        return False
    return True


def install_requirements():
    if not internet_available():
        print_hint("无法连接 pypi.org，请检查网络或代理后重试。")
    return run(
        [str(PYTHON), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
        "升级 pip 基础工具",
        [
            "如果网络超时，请配置代理后重试。",
        ],
    ) and run(
        [str(PYTHON), "-m", "pip", "install", "-r", "requirements.txt"],
        "安装基础依赖",
        [
            "如果提示 pip 版本或构建失败，可先执行: python -m pip install --upgrade pip setuptools wheel。",
            "如果提示网络超时，请切换网络或设置代理后重试。",
            "如果提示权限问题，请确认正在使用项目内 .venv，而不是系统 Python。",
        ],
    )


def install_ml_requirements():
    if not internet_available():
        print_hint("无法连接 pypi.org，请检查网络或代理后重试。")
    return run(
        [str(PYTHON), "-m", "pip", "install", "torch==2.5.1", "--index-url", "https://download.pytorch.org/whl/cpu"],
        "安装 PyTorch CPU 版本",
        [
            "如果网络无法访问 download.pytorch.org，请检查网络或配置代理。",
            "如果下载速度慢，请切换网络或配置代理后重试。",
        ],
    ) and run(
        [str(PYTHON), "-m", "pip", "install", "-r", "requirements-ml.txt"],
        "安装真实 Embedding 依赖",
        [
            "如果安装失败，请检查网络是否能访问 PyPI。",
            "请确认网络通畅后重新运行启动脚本。",
        ],
    )


def model_is_downloaded():
    return all((MODEL_DIR / filename).is_file() for filename in MODEL_REQUIRED_FILES)


def download_embedding_model():
    if model_is_downloaded():
        print_step("本地 Embedding 模型已存在")
        print(MODEL_DIR)
        return True

    if MODEL_DIR.exists():
        print_hint("检测到未完成的模型目录，将尝试继续下载缺失文件。")

    download_code = (
        "from huggingface_hub import snapshot_download; "
        f"snapshot_download(repo_id={MODEL_REPO_ID!r}, local_dir={str(MODEL_DIR)!r})"
    )
    return run(
        [str(PYTHON), "-c", download_code],
        "下载本地 Embedding 模型",
        [
            "请检查网络、代理以及 huggingface.co 是否可以访问后重试。",
            f"手动下载地址: {MODEL_DOWNLOAD_URL}",
            f"下载完成后请将模型文件放到: {MODEL_DIR}",
            "也可以直接重新运行启动脚本，下载器会复用已有文件并继续下载。",
        ],
    )


def load_runner_config():
    parser = configparser.ConfigParser()
    try:
        parser.read(RUNNER_CONFIG_PATH, encoding="utf-8")
    except (configparser.Error, OSError, UnicodeError) as exc:
        print_hint(f"runner.config 无法读取，将使用默认 local 模式: {exc}")
        return {"mode": "local", "host": "127.0.0.1", "port": 8765}
    mode = parser.get("runner", "mode", fallback="local").strip().lower()
    if mode not in {"local", "docker"}:
        print_hint(f"runner.config 中的 mode={mode!r} 无效，将使用默认 local 模式。")
        mode = "local"
    host = parser.get("runner", "host", fallback="127.0.0.1").strip() or "127.0.0.1"
    try:
        port = parser.getint("runner", "port", fallback=8765)
    except ValueError:
        print_hint("runner.config 中的 port 无效，将使用 8765。")
        port = 8765
    if not 1 <= port <= 65535:
        print_hint("runner.config 中的 port 超出范围，将使用 8765。")
        port = 8765
    return {"mode": mode, "host": host, "port": port}


def get_runner_token():
    RUNNER_STATE_DIR.mkdir(parents=True, exist_ok=True)
    token_path = RUNNER_STATE_DIR / "token"
    if token_path.exists():
        token = token_path.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = secrets.token_urlsafe(32)
    token_path.write_text(token, encoding="utf-8")
    try:
        token_path.chmod(0o600)
    except OSError:
        pass
    return token


def runner_health(url, expected_mode, token):
    try:
        request = urllib.request.Request(f"{url}/health", headers={"X-Runner-Token": token})
        with urllib.request.urlopen(request, timeout=1) as response:
            payload = json.loads(response.read(16 * 1024))
        return (
            bool(payload.get("ok"))
            and bool(payload.get("authenticated"))
            and payload.get("executionMode") == expected_mode
        )
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False


def start_local_runner(config):
    global LOCAL_RUNNER_PROCESS
    url = f"http://{config['host']}:{config['port']}"
    token = os.environ["RUNNER_SHARED_TOKEN"]
    if runner_health(url, "local", token):
        print_step("本地代码 Runner 已在运行")
        return True

    runner_env = os.environ.copy()
    runner_env.update(
        {
            "RUNNER_HOST": config["host"],
            "RUNNER_PORT": str(config["port"]),
            "RUNNER_SHARED_TOKEN": token,
            "RUNNER_EXECUTION_MODE": "local",
        }
    )
    creation_flags = subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0
    print_step("启动本地代码 Runner")
    try:
        LOCAL_RUNNER_PROCESS = subprocess.Popen(
            [str(PYTHON), str(ROOT / "runner" / "runner_server.py")],
            cwd=ROOT,
            env=runner_env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
    except OSError as exc:
        print_hint(f"本地 Runner 启动失败: {exc}")
        return False

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if runner_health(url, "local", token):
            print(f"本地 Runner: {url}")
            return True
        if LOCAL_RUNNER_PROCESS.poll() is not None:
            break
        time.sleep(0.2)
    print_hint("本地 Runner 未能在 5 秒内启动，请检查端口是否被占用。")
    stop_local_runner()
    return False


def stop_local_runner():
    global LOCAL_RUNNER_PROCESS
    if LOCAL_RUNNER_PROCESS is None or LOCAL_RUNNER_PROCESS.poll() is not None:
        LOCAL_RUNNER_PROCESS = None
        return
    LOCAL_RUNNER_PROCESS.terminate()
    try:
        LOCAL_RUNNER_PROCESS.wait(timeout=3)
    except subprocess.TimeoutExpired:
        LOCAL_RUNNER_PROCESS.kill()
        LOCAL_RUNNER_PROCESS.wait(timeout=2)
    finally:
        LOCAL_RUNNER_PROCESS = None


def start_docker_runner(config):
    docker = shutil.which("docker")
    if not docker:
        print_step("隔离代码 Runner 未启动")
        print_hint("runner.config 选择了 docker，但未找到 Docker。")
        print_hint("安装地址: https://docs.docker.com/get-docker/")
        return False
    os.environ["RUNNER_PUBLISH_HOST"] = config["host"]
    os.environ["RUNNER_PUBLISH_PORT"] = str(config["port"])
    return run(
        [docker, "compose", "up", "-d", "--build", "runner"],
        "启动隔离代码 Runner",
        [
            "请确认 Docker Desktop 或 Docker Engine 已启动。",
            "可手动执行: docker compose up -d --build runner",
            "Runner 失败不会阻止基础网站启动，但 Python/C/C++/Java 暂时无法运行。",
        ],
    )


def start_code_runner():
    config = load_runner_config()
    os.environ["RUNNER_SHARED_TOKEN"] = get_runner_token()
    os.environ["RUNNER_SERVICE_URL"] = f"http://{config['host']}:{config['port']}"
    print_hint(f"Runner 模式: {config['mode'].upper()}（由 runner.config 决定）")
    return start_local_runner(config) if config["mode"] == "local" else start_docker_runner(config)


def migrate_database():
    return run(
        [str(PYTHON), "manage.py", "migrate"],
        "执行数据库迁移",
        [
            "如果提示 No module named django，请先安装依赖: .venv 内 Python -m pip install -r requirements.txt。",
            "如果提示数据库被占用，请关闭正在运行的 Django 服务后重试。",
        ],
    )


def seed_data():
    return run(
        [str(PYTHON), "manage.py", "seed_learning_data"],
        "导入学习数据",
        [
            "如果提示找不到 knowledge.json，请确认 rebuild_assets/knowledge.json 已随仓库下载。",
            "如果提示 no such table，请先执行数据库迁移。",
        ],
    )


def check_environment():
    return run(
        [str(PYTHON), "scripts/check_environment.py"],
        "运行环境检测",
        ["请根据检测脚本输出的处理建议修复后再次执行启动脚本。"],
    )


def runserver(host_port):
    print_step("启动 Django 服务")
    print(f"访问地址: http://{host_port}/")
    print("停止服务: Ctrl + C")
    try:
        result = subprocess.run([str(PYTHON), "manage.py", "runserver", host_port], cwd=ROOT)
    except KeyboardInterrupt:
        return True
    finally:
        stop_local_runner()
    if result.returncode != 0:
        print("\n服务启动失败")
        print_hint("如果提示端口被占用，请换端口运行，例如: --host-port 127.0.0.1:8001")
        print_hint("如果提示 ALLOWED_HOSTS，请设置 DJANGO_ALLOWED_HOSTS 环境变量。")
        return False
    return True


def parse_args():
    args = {"host_port": "127.0.0.1:8000", "no_server": False, "no_runner": False}
    index = 1
    while index < len(sys.argv):
        item = sys.argv[index]
        if item == "--no-server":
            args["no_server"] = True
        elif item == "--no-runner":
            args["no_runner"] = True
        elif item == "--port" and index + 1 < len(sys.argv):
            args["host_port"] = f"127.0.0.1:{sys.argv[index + 1]}"
            index += 1
        elif item == "--host-port" and index + 1 < len(sys.argv):
            args["host_port"] = sys.argv[index + 1]
            index += 1
        else:
            print_hint(f"忽略未知参数: {item}")
        index += 1
    return args


def main():
    args = parse_args()
    print("AI 学习星图一键启动")
    print(f"系统: {platform.system()} {platform.release()}")
    print(f"项目目录: {ROOT}")

    python_command = find_python()
    if not python_command:
        print("未找到 Python 3.12 或更高版本。")
        print_hint("请安装 Python 3.12+ 后重新运行。")
        return 1

    for step in [create_venv, install_requirements, install_ml_requirements, download_embedding_model]:
        ok = step(python_command) if step == create_venv else step()
        if not ok:
            print("\n启动准备未完成，请按上方提示修复问题后重新运行。")
            return 1
    for step in [migrate_database, seed_data, check_environment]:
        if not step():
            print("\n启动准备未完成，请按上方提示修复问题后重新运行。")
            return 1
    if args["no_server"]:
        print("\n启动准备完成。")
        return 0
    if not args["no_runner"] and not start_code_runner():
        print_hint("基础网站将继续启动；代码工坊会在运行时显示 Runner 连接提示。")
    return 0 if runserver(args["host_port"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
