import os
import platform
import shutil
import socket
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VENV_DIR = ROOT / ".venv"
IS_WINDOWS = os.name == "nt"
PYTHON = VENV_DIR / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


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
    result = subprocess.run([str(PYTHON), "manage.py", "runserver", host_port], cwd=ROOT)
    if result.returncode != 0:
        print("\n服务启动失败")
        print_hint("如果提示端口被占用，请换端口运行，例如: --host-port 127.0.0.1:8001")
        print_hint("如果提示 ALLOWED_HOSTS，请设置 DJANGO_ALLOWED_HOSTS 环境变量。")
        return False
    return True


def parse_args():
    args = {"host_port": "127.0.0.1:8000", "no_server": False, "with_ml": False}
    index = 1
    while index < len(sys.argv):
        item = sys.argv[index]
        if item == "--no-server":
            args["no_server"] = True
        elif item == "--with-ml":
            args["with_ml"] = True
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

    for step in [create_venv, install_requirements]:
        ok = step(python_command) if step == create_venv else step()
        if not ok:
            print("\n启动准备未完成，请按上方提示修复问题后重新运行。")
            return 1
    if args["with_ml"] and not install_ml_requirements():
        print("\n真实 Embedding 依赖安装失败，启动终止。请按上方提示修复问题后重新运行。")
        return 1
    for step in [migrate_database, seed_data, check_environment]:
        if not step():
            print("\n启动准备未完成，请按上方提示修复问题后重新运行。")
            return 1
    if args["no_server"]:
        print("\n启动准备完成。")
        return 0
    return 0 if runserver(args["host_port"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
