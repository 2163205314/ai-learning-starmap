# AI 学习星图

AI 学习星图是一个基于 **Python + Django + SQLite + Django Templates + 原生 HTML/CSS/JavaScript** 的本地 AI 学习网站，用课程、实验室、项目实战和概念词典展示 Agent、RAG、Embedding、Transformer 与工程部署知识。

## 功能概览

- 首页：深空星图首页、学习路径、知识模块入口、概念星图。
- 课程学习：按模块浏览知识卡片，展开章节，查看代码示例，完成测验。
- 互动实验室：RAG 流程、Chunk 调节、真实/模拟 Embedding 相似度、Attention 拆解。
- 代码工坊：使用与 VS Code 同源的 Monaco Editor，切换 JavaScript、Python、C、C++、Java、HTML 和 CSS；Python 通过 Pyright 提供实时补全、诊断、悬停说明和参数提示，并可查看判题、Runner 输出或安全预览。
- 项目实战：智能客服 RAG 项目 6 步构建、Token 预算、延迟估算。
- 概念词典：概念搜索、分类筛选、关联概念跳转。
- Django Admin：管理模块、卡片、章节、概念、路径、测验。

## 环境要求

- Python：建议 `3.12` 或更高版本。
- 操作系统：Windows / macOS / Linux 均可，README 分别提供对应命令。
- 网络：运行基础功能不需要联网；首次安装 Python 智能提示或真实 Embedding 模型时需要联网下载依赖。
- 本地 Runner：Python 直接使用项目虚拟环境；运行 C、C++、Java 还需分别安装 GCC、G++、JDK 并加入 `PATH`。
- Docker Runner（可选）：选择容器模式时需要 Docker Desktop 或 Docker Engine。
- Python 实时智能提示（可选）：需要 Node.js LTS 和 npm 来安装、运行 Pyright；不需要 React、Vite、Tailwind 或前端构建步骤。

## Python 实时智能提示

代码工坊采用最小可用的本地 LSP 架构：Monaco 在浏览器中编辑，独立 WebSocket 网关转发 LSP 消息，Pyright 提供 Python 语义分析。JavaScript、HTML、CSS 继续使用 Monaco 内置提示，C、C++、Java 暂时使用基础编辑能力。

- 一键启动脚本会把固定版本的 Pyright 安装到被 Git 忽略的 `.lsp/`，不会污染全局 npm 环境。
- 网关只监听 `127.0.0.1:8766`，使用随机令牌、Origin 校验、消息上限和连接数限制；每个浏览器连接都有独立临时工作区，断开后会终止 Pyright 并清理目录。
- 当前实测 `.lsp/` 约占 `18.5 MiB`；仓库内 Monaco 静态资源约占 `23.4 MiB`。实际体积可能随依赖版本和文件系统略有变化，不需要大型模型或额外数据库。
- Pyright 安装或启动失败时页面会显示 `PYRIGHT OFFLINE`，编辑器仍会自动降级，不影响其他语言和代码运行。

国内网络下载 npm 较慢时，可先切换镜像再运行启动脚本：

```powershell
npm config set registry https://registry.npmmirror.com
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

如不需要 Python 实时智能提示，可跳过安装和网关启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 --no-lsp
```

macOS / Linux 使用 `./start.sh --no-lsp`。直接执行 `python manage.py runserver` 时也会尝试启动本地 LSP 网关；若 `.lsp/` 尚未安装，则自动降级为 Monaco 基础提示。

## 代码 Runner 模式

根目录的 `runner.config` 决定 Python、C、C++、Java 的执行环境，默认使用本地模式：

```ini
[runner]
mode = local
host = 127.0.0.1
port = 8765
```

- `mode = local`：启动独立于 Django 的本地 Runner 进程，使用本机工具链。每次运行都在随机临时目录中写入源码、编译并执行，结束、失败或超时后都会删除源码、可执行文件和输出文件。该模式只适合运行自己信任的学习代码，不是恶意代码安全沙箱。
- `mode = docker`：启动 `compose.yaml` 中受限的 Runner 容器，使用容器内的 Python、GCC、G++ 和 JDK，并启用只读文件系统、无外网网络、非 root 用户以及 CPU、内存、PID、时间和输出限制。

修改 `mode` 后重新运行启动脚本即可切换。Django 只负责校验请求并通过 HTTP 转发，任何模式都不会在 Django Web 进程中直接执行用户代码。

使用 IDE 或命令行直接执行 `python manage.py runserver` 时，也会读取同一份 `runner.config`，自动启动 Runner，并在开发服务器退出时关闭由它启动的本地 Runner。

## 使用 Docker Compose 启动容器模式

下面的命令会直接同时启动 Django 和 Docker Runner，不读取宿主机启动脚本的 `runner.config`：

```bash
docker compose up -d --build
```

访问 `http://localhost:8000/`。查看状态和日志：

```bash
docker compose ps
docker compose logs -f web runner
```

停止服务：

```bash
docker compose down
```

Runner 只在 `127.0.0.1:8765` 暴露调试端口，并通过内部网络与 Django 通信。它使用非 root 用户、只读文件系统、临时目录、无外网网络、默认 seccomp、能力清空以及 CPU、内存、PID、运行时间和输出大小限制。

建议复制 `.env.example` 为 `.env`，并把 `RUNNER_SHARED_TOKEN` 改成随机长字符串：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 仅启动基础 Django 容器

以下旧式单容器方式不会启动隔离 Runner，因此 Python、C、C++、Java 只能编辑，不能在网页中运行。需要完整代码工坊时使用上面的 Docker Compose 方式。

请先安装并启动 Docker Desktop（Windows / macOS）或 Docker Engine（Linux）。项目使用固定名称 `ai-learning-starmap` 的容器，并把当前仓库挂载到 `/app`，因此可以直接在容器内执行 Git 命令。

### 1. 构建镜像

```bash
docker build -t ai-learning-starmap .
```

镜像内已安装 Git 和 OpenSSH。宿主机的 Git 配置与 SSH 密钥不会写入镜像，而是在创建容器时只读挂载。

### 2. 用一条命令创建固定容器

如果项目根目录还没有 `.env`，先复制示例：Windows PowerShell 执行 `Copy-Item .env.example .env`，macOS / Linux 执行 `cp .env.example .env`。

以下是一条完整的 `docker run` 命令，PowerShell、macOS 和 Linux Shell 均可直接执行：

```bash
docker run -d --name ai-learning-starmap --restart unless-stopped -p 8000:8000 --env-file .env -v "${PWD}:/app" -v "ai-learning-data:/app/data" -v "${HOME}/.gitconfig:/run/host-gitconfig:ro" -v "${HOME}/.ssh:/run/host-ssh:ro" ai-learning-starmap
```

这条命令只执行一次：

- `--name ai-learning-starmap` 固定容器名称。
- `--restart unless-stopped` 让 Docker 重启后自动恢复容器。
- `${PWD}:/app` 挂载当前 Git 仓库，容器内外共享代码和 `.git`。
- `${HOME}/.gitconfig` 和 `${HOME}/.ssh` 提供宿主机 Git 身份及 GitHub SSH 认证。
- `ai-learning-data:/app/data` 持久化 SQLite 数据库。

首次启动会自动执行数据库迁移，并在数据库为空时导入学习数据。

如果已经存在此前创建的同名容器，需要先执行一次 `docker stop ai-learning-starmap` 和 `docker rm ai-learning-starmap`，再执行新的创建命令。该操作不会删除 `ai-learning-data` 数据卷。

日常只操作这个已有容器，不要再次执行 `docker run`：

```bash
# 启动已有容器
docker start ai-learning-starmap

# 停止但保留容器
docker stop ai-learning-starmap

# 重启已有容器
docker restart ai-learning-starmap

# 查看状态和日志
docker ps -a --filter "name=ai-learning-starmap"
docker logs -f ai-learning-starmap
```

### 3. 在容器内 Pull 和 Push

先验证容器能读取 Git 配置和 GitHub 仓库：

```bash
docker exec ai-learning-starmap git config --global --list
docker exec ai-learning-starmap git remote -v
docker exec ai-learning-starmap git ls-remote origin HEAD
```

然后可以直接操作当前分支：

```bash
docker exec ai-learning-starmap git status
docker exec ai-learning-starmap git pull origin main
docker exec ai-learning-starmap git push origin main
```

`/app` 是宿主机当前项目目录的挂载，因此容器内 Pull 下来的文件会立即出现在宿主机，宿主机修改也会立即出现在容器。代码更新后执行 `docker restart ai-learning-starmap` 让 Django 重新加载代码。

### 4. 连接网站

容器启动后访问 `http://localhost:8000/`。如果 8000 端口被占用，把创建命令中的 `-p 8000:8000` 改成 `-p 8001:8000`，然后访问 `http://localhost:8001/`。

如果从局域网其他设备访问，请把 `.env` 中的 `DJANGO_ALLOWED_HOSTS` 加上运行 Docker 的主机 IP，例如 `DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,192.168.1.10`，并确保主机防火墙允许对应的 TCP 端口。

## 从 GitHub 克隆后启动

推荐优先使用一键启动脚本。脚本会自动检查 Python 版本、创建 `.venv`、安装依赖、执行数据库迁移、导入学习数据、运行环境检测，并按照 `runner.config` 启动本地或 Docker Runner。默认本地模式不要求安装 Docker；缺少某种本机工具链时，代码工坊会显示对应提示。

### 一键启动

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Windows CMD：

```bat
start.bat
```

macOS / Linux：

```bash
chmod +x start.sh
./start.sh
```

如果 8000 端口被占用，可以换端口：

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 --host-port 127.0.0.1:8001
```

Windows CMD：

```bat
start.bat --host-port 127.0.0.1:8001
```

macOS / Linux：

```bash
./start.sh --host-port 127.0.0.1:8001
```

如果只想准备环境、不启动服务：

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 --no-server
```

Windows CMD：

```bat
start.bat --no-server
```

macOS / Linux：

```bash
./start.sh --no-server
```

如果明确只需要 JavaScript Worker 和 HTML/CSS 预览，可以跳过代码 Runner：

```bash
./start.sh --no-runner
```

Windows 同样可以把 `--no-runner` 追加到 `start.ps1` 或 `start.bat`。

如果希望同时安装真实 Embedding 模型依赖，可加上参数。该步骤需要访问 PyTorch、PyPI 和 Hugging Face，网络不稳定时可以先跳过，基础网站仍可启动。

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 --with-ml
```

Windows CMD：

```bat
start.bat --with-ml
```

macOS / Linux：

```bash
./start.sh --with-ml
```

### 手动启动

### 1. 进入项目目录

Windows PowerShell：

```powershell
cd D:\your\path\ai-learning-starmap
```

macOS / Linux：

```bash
cd /your/path/ai-learning-starmap
```

### 2. 创建虚拟环境

Windows PowerShell：

```powershell
python -m venv .venv
```

macOS / Linux：

```bash
python3 -m venv .venv
```

如果 `python` 或 `python3` 不是 Python 3.12，可先检查：

Windows PowerShell：

```powershell
python --version
```

macOS / Linux：

```bash
python3 --version
```

### 3. 安装基础依赖

推荐不依赖激活脚本，直接使用虚拟环境里的 Python 安装依赖。

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS / Linux：

```bash
./.venv/bin/python -m pip install -r requirements.txt
```

如果你希望激活虚拟环境，可使用下面命令。

Windows PowerShell 可能禁止执行 `Activate.ps1`，可临时允许当前窗口执行脚本：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

Windows CMD：

```bat
.venv\Scripts\activate.bat
```

macOS / Linux：

```bash
source .venv/bin/activate
```

### 4. 初始化数据库

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

macOS / Linux：

```bash
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_learning_data
```

导入成功后会从 `rebuild_assets/knowledge.json` 创建：5 个模块、18 张知识卡片、26 个概念、4 条学习路径、13 道测验题。

### 5. 检测环境

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe scripts\check_environment.py
```

macOS / Linux：

```bash
./.venv/bin/python scripts/check_environment.py
```

检测脚本会检查：Python 版本、虚拟环境、Django 依赖、必要文件、SQLite 数据、可选真实 Embedding 依赖和模型目录。若有问题，会输出处理建议。

### 6. 启动项目

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

macOS / Linux：

```bash
./.venv/bin/python manage.py runserver
```

访问：

```text
http://127.0.0.1:8000/
```

## 页面地址

- 首页：`http://127.0.0.1:8000/`
- 课程学习：`http://127.0.0.1:8000/courses/`
- 互动实验室：`http://127.0.0.1:8000/lab/`
- 代码工坊：`http://127.0.0.1:8000/playground/`
- 项目实战：`http://127.0.0.1:8000/project/`
- 概念词典：`http://127.0.0.1:8000/glossary/`
- 后台管理：`http://127.0.0.1:8000/admin/`

项目的模块边界、前端分层和未来多语言代码执行安全方案见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 可选：启用真实 Embedding 模型

项目默认会优先尝试加载本地真实模型。如果依赖或模型不存在，会自动降级为增强模拟语义词库和字符相似度兜底，并在接口返回中说明 `method` 与 `details.modelStatus`。

### 安装真实模型依赖

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe -m pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
```

macOS / Linux：

```bash
./.venv/bin/python -m pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
./.venv/bin/python -m pip install -r requirements-ml.txt
```

### 下载模型到本地目录

`start.ps1`、`start.bat` 和 `start.sh` 会在模型缺失时自动从 Hugging Face 下载，并在网络中断后再次启动时继续下载。只有自动下载失败时，才需要使用下面的手动命令。

模型页面：<https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2>

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe -c "from huggingface_hub import snapshot_download; snapshot_download('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_dir='models/paraphrase-multilingual-MiniLM-L12-v2')"
```

macOS / Linux：

```bash
./.venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_dir='models/paraphrase-multilingual-MiniLM-L12-v2')"
```

如果网络不稳定，可重新运行启动脚本或重复执行下载命令，Hugging Face 会复用已下载文件。

### 验证真实模型

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe -c "from sentence_transformers import SentenceTransformer; from sentence_transformers.util import cos_sim; model=SentenceTransformer('models/paraphrase-multilingual-MiniLM-L12-v2'); e=model.encode(['猫','虎']); print(len(e[0])); print(float(cos_sim(e[0], e[1])[0][0]))"
```

macOS / Linux：

```bash
./.venv/bin/python -c "from sentence_transformers import SentenceTransformer; from sentence_transformers.util import cos_sim; model=SentenceTransformer('models/paraphrase-multilingual-MiniLM-L12-v2'); e=model.encode(['猫','虎']); print(len(e[0])); print(float(cos_sim(e[0], e[1])[0][0]))"
```

输出中如果出现 `384`，说明模型向量维度正常。

## 常见问题

### PowerShell 无法激活虚拟环境

报错示例：

```text
无法加载文件 .venv\Scripts\Activate.ps1，因为在此系统上禁止运行脚本
```

推荐不激活虚拟环境，直接运行：

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

或仅对当前 PowerShell 窗口放开策略：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### ModuleNotFoundError: No module named 'django'

说明没有安装基础依赖，执行：

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS / Linux：

```bash
./.venv/bin/python -m pip install -r requirements.txt
```

### no such table: learning_xxx

说明数据库迁移未执行，执行：

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

macOS / Linux：

```bash
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_learning_data
```

### 页面有框架但没有课程数据

说明还没有导入 `knowledge.json`：

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

macOS / Linux：

```bash
./.venv/bin/python manage.py seed_learning_data
```

### Embedding 显示模拟结果

说明真实模型依赖或模型文件不存在。基础功能仍可使用；若要真实模型，按“可选：启用真实 Embedding 模型”安装。

### 下载 Hugging Face 模型超时

启动脚本会先自动尝试下载。失败时请设置代理或恢复网络后重新运行；也可以从 <https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2> 手动下载到 `models/paraphrase-multilingual-MiniLM-L12-v2`。模型目录 `models/` 不提交到 GitHub。

### 端口 8000 被占用

换一个端口启动：

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

macOS / Linux：

```bash
./.venv/bin/python manage.py runserver 127.0.0.1:8001
```

## 数据说明

网站内容来自：

```text
rebuild_assets/knowledge.json
```

数据库由以下命令生成，不需要提交：

Windows PowerShell：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

macOS / Linux：

```bash
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_learning_data
```

## 最小复刻命令

如果用户只想快速启动基础版本，优先执行一键启动脚本。

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Windows CMD：

```bat
start.bat
```

macOS / Linux：

```bash
chmod +x start.sh
./start.sh
```

如果一键启动脚本无法使用，再按顺序手动执行。

Windows PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
.\.venv\Scripts\python.exe scripts\check_environment.py
.\.venv\Scripts\python.exe manage.py runserver
```

macOS / Linux：

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_learning_data
./.venv/bin/python scripts/check_environment.py
./.venv/bin/python manage.py runserver
```

然后打开：

```text
http://127.0.0.1:8000/
```
