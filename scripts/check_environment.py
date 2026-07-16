import importlib.metadata
import os
import platform
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def status(ok, label, detail, fix=""):
    mark = "OK" if ok else "需要处理"
    print(f"[{mark}] {label}: {detail}")
    if not ok and fix:
        print(f"  处理建议: {fix}")
    return ok


def package_version(name):
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def check_python():
    version = sys.version_info
    ok = version >= (3, 12)
    detail = f"{platform.python_version()} ({sys.executable})"
    return status(ok, "Python 版本", detail, "请安装 Python 3.12 或更高版本，并重新创建虚拟环境。")


def check_venv():
    in_venv = sys.prefix != sys.base_prefix or bool(os.environ.get("VIRTUAL_ENV"))
    expected = ROOT / ".venv"
    detail = f"当前解释器: {sys.executable}"
    fix = f"推荐使用: {python_bin()} scripts/check_environment.py"
    return status(in_venv or str(sys.executable).lower().startswith(str(expected).lower()), "虚拟环境", detail, fix)


def python_bin():
    if os.name == "nt":
        return str(ROOT / ".venv" / "Scripts" / "python.exe")
    return str(ROOT / ".venv" / "bin" / "python")


def cmd(args):
    return f"{python_bin()} {args}"


def check_required_packages():
    required = ["Django"]
    ok = True
    for name in required:
        version = package_version(name)
        ok = status(bool(version), f"依赖 {name}", version or "未安装", cmd("-m pip install -r requirements.txt")) and ok
    return ok


def check_ml():
    torch_version = package_version("torch")
    st_version = package_version("sentence-transformers")
    model_dir = ROOT / "models" / "paraphrase-multilingual-MiniLM-L12-v2"
    ok = True
    print("\n真实 Embedding 依赖：")
    ok = status(bool(torch_version), "torch", torch_version or "未安装", cmd("-m pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu")) and ok
    ok = status(bool(st_version), "sentence-transformers", st_version or "未安装", cmd("-m pip install -r requirements-ml.txt")) and ok
    ok = status(model_dir.exists(), "本地模型目录", str(model_dir) if model_dir.exists() else "未下载", "请确保模型已下载至 models/paraphrase-multilingual-MiniLM-L12-v2") and ok
    return ok


def check_files():
    files = [
        "manage.py",
        "requirements.txt",
        "requirements-ml.txt",
        "rebuild_assets/knowledge.json",
        "learning/templates/learning/lab.html",
        "learning/static/learning/css/style.css",
    ]
    ok = True
    for item in files:
        path = ROOT / item
        ok = status(path.exists(), f"必要文件 {item}", "存在" if path.exists() else "缺失", "请确认仓库文件完整，必要时重新 clone。") and ok
    return ok


def check_database():
    db_path = ROOT / "db.sqlite3"
    if not db_path.exists():
        return status(False, "SQLite 数据库", "尚未创建", f"{cmd('manage.py migrate')}; {cmd('manage.py seed_learning_data')}")
    try:
        with sqlite3.connect(db_path) as conn:
            cards = conn.execute("select count(*) from learning_knowledgecard").fetchone()[0]
        return status(cards > 0, "SQLite 数据", f"知识卡片 {cards} 条", cmd("manage.py seed_learning_data"))
    except sqlite3.Error as exc:
        return status(False, "SQLite 数据", f"无法读取: {exc}", f"{cmd('manage.py migrate')}; {cmd('manage.py seed_learning_data')}")


def main():
    print("AI 学习星图环境检测")
    print(f"项目目录: {ROOT}\n")
    checks = [check_python(), check_venv(), check_required_packages(), check_files(), check_database(), check_ml()]
    print("\n结论:")
    if all(checks):
        print(f"全部环境就绪。启动命令: {cmd('manage.py runserver')}")
    else:
        print("环境还未完全就绪，请按上方处理建议修复后再次运行检测。")


if __name__ == "__main__":
    main()
