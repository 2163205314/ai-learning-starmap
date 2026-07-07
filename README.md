# AI 学习星图

AI 学习星图是一个基于 **Python + Django + SQLite + Django Templates + 原生 HTML/CSS/JavaScript** 的本地 AI 学习网站，用课程、实验室、项目实战和概念词典展示 Agent、RAG、Embedding、Transformer 与工程部署知识。

## 功能概览

- 首页：深空星图首页、学习路径、知识模块入口、概念星图。
- 课程学习：按模块浏览知识卡片，展开章节，查看代码示例，完成测验。
- 互动实验室：RAG 流程、Chunk 调节、真实/模拟 Embedding 相似度、Attention 拆解。
- 项目实战：智能客服 RAG 项目 6 步构建、Token 预算、延迟估算。
- 概念词典：概念搜索、分类筛选、关联概念跳转。
- Django Admin：管理模块、卡片、章节、概念、路径、测验。

## 环境要求

- Python：建议 `3.12` 或更高版本。
- 操作系统：Windows / macOS / Linux 均可，本 README 以 Windows PowerShell 为主。
- 网络：基础功能不需要联网；安装真实 Embedding 模型需要联网下载 PyTorch 和 Hugging Face 模型。
- 不需要 Node.js、React、Vite、Tailwind。

## 从 GitHub 克隆后启动

### 1. 进入项目目录

```powershell
cd D:\your\path\ai-learning-starmap
```

### 2. 创建虚拟环境

```powershell
python -m venv .venv
```

如果 `python` 不是 Python 3.12，可先检查：

```powershell
python --version
```

### 3. 安装基础依赖

PowerShell 可能禁止执行 `Activate.ps1`。为避免执行策略问题，推荐直接使用虚拟环境 Python：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

如果你希望激活虚拟环境，可临时允许当前窗口执行脚本：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### 4. 初始化数据库

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

导入成功后会从 `rebuild_assets/knowledge.json` 创建：5 个模块、18 张知识卡片、26 个概念、4 条学习路径、13 道测验题。

### 5. 检测环境

```powershell
.\.venv\Scripts\python.exe scripts\check_environment.py
```

检测脚本会检查：Python 版本、虚拟环境、Django 依赖、必要文件、SQLite 数据、可选真实 Embedding 依赖和模型目录。若有问题，会输出处理建议。

### 6. 启动项目

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

访问：

```text
http://127.0.0.1:8000/
```

## 页面地址

- 首页：`http://127.0.0.1:8000/`
- 课程学习：`http://127.0.0.1:8000/courses/`
- 互动实验室：`http://127.0.0.1:8000/lab/`
- 项目实战：`http://127.0.0.1:8000/project/`
- 概念词典：`http://127.0.0.1:8000/glossary/`
- 后台管理：`http://127.0.0.1:8000/admin/`

## 可选：启用真实 Embedding 模型

项目默认会优先尝试加载本地真实模型。如果依赖或模型不存在，会自动降级为增强模拟语义词库和字符相似度兜底，并在接口返回中说明 `method` 与 `details.modelStatus`。

### 安装真实模型依赖

```powershell
.\.venv\Scripts\python.exe -m pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
```

### 下载模型到本地目录

```powershell
.\.venv\Scripts\python.exe -c "from huggingface_hub import snapshot_download; snapshot_download('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_dir='models/paraphrase-multilingual-MiniLM-L12-v2')"
```

如果网络不稳定，可重复执行下载命令，Hugging Face 会复用已下载缓存。

### 验证真实模型

```powershell
.\.venv\Scripts\python.exe -c "from sentence_transformers import SentenceTransformer; from sentence_transformers.util import cos_sim; model=SentenceTransformer('models/paraphrase-multilingual-MiniLM-L12-v2'); e=model.encode(['猫','虎']); print(len(e[0])); print(float(cos_sim(e[0], e[1])[0][0]))"
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

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### no such table: learning_xxx

说明数据库迁移未执行，执行：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

### 页面有框架但没有课程数据

说明还没有导入 `knowledge.json`：

```powershell
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

### Embedding 显示模拟结果

说明真实模型依赖或模型文件不存在。基础功能仍可使用；若要真实模型，按“可选：启用真实 Embedding 模型”安装。

### 下载 Hugging Face 模型超时

可重复执行下载命令，或设置代理后重试。模型目录 `models/` 不提交到 GitHub，用户本地首次使用时自行下载。

### 端口 8000 被占用

换一个端口启动：

```powershell
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

## GitHub 上传建议

### 应该上传

- `ai_learning/`：Django 项目配置。
- `learning/`：应用源码、模板、静态资源、迁移文件、管理命令。
- `rebuild_assets/knowledge.json`：核心结构化知识数据。
- `rebuild_assets/knowledge.ts`：结构化数据备份，便于人工核对。
- `DJANGO_REBUILD_SPEC.md`：项目重构规格说明。
- `manage.py`
- `requirements.txt`
- `requirements-ml.txt`
- `README.md`
- `.gitignore`
- `.env.example`
- `scripts/check_environment.py`

### 不应该上传

- `.venv/`：虚拟环境，体积大且与本机路径绑定。
- `__pycache__/`、`*.pyc`：Python 运行缓存。
- `db.sqlite3`：本地生成数据库，用户应通过迁移和导入命令生成。
- `models/`：真实 Embedding 模型，体积大，用户按 README 下载。
- `.trae/`、`.vscode/`、`.idea/`：本地 IDE 或工具配置。
- `conversations.json`、`rebuild_assets/conversations.json`：原始对话数据，可能包含私有内容；GitHub 只需要 `rebuild_assets/knowledge.json` 即可复刻网站内容。
- `.env`、`.env.*`：本地环境变量或密钥。

## 数据说明

网站内容来自：

```text
rebuild_assets/knowledge.json
```

数据库由以下命令生成，不需要提交：

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

## 最小复刻命令

如果用户只想快速启动基础版本，按顺序执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
.\.venv\Scripts\python.exe scripts\check_environment.py
.\.venv\Scripts\python.exe manage.py runserver
```

然后打开：

```text
http://127.0.0.1:8000/
```
