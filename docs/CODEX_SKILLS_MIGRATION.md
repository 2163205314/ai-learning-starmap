# Codex Skills 使用与迁移说明

本文记录本次“AI 学习星图”前端、架构、模块化和代码工坊改造过程中实际调用的 Codex Skills，以及其他成员迁移相同工作环境时需要执行的步骤。

文中的用户名、安装目录和项目目录均使用占位符，不包含任何成员的个人信息。

## 1. 先区分三个概念

### Skill

Skill 是一套可复用的任务工作流说明，通常包含 `SKILL.md`，也可能包含脚本、参考资料和模板。Skill 会指导 Codex 在特定任务中采取什么流程。

### Plugin

Plugin 是可安装的功能包，一个 Plugin 可以同时提供多个 Skills、工具、MCP 服务、资源和应用能力。

### AGENTS.md

`AGENTS.md` 不是 Skill。它是仓库级长期工程约定，用来告诉进入当前项目的 Codex：应该遵守哪些架构、代码、安全、测试和设计规则。

本项目通过以下组合保持一致性：

```text
Codex Skills：提供通用工作流
Plugin Tools：提供浏览器等实际能力
AGENTS.md：提供当前仓库的长期约束
ARCHITECTURE.md：记录项目的模块边界与架构决策
```

## 2. 本次实际调用的 Skills

### 2.1 openai-docs

来源：Codex 系统 Skill。

本次用途：

- 检查 Codex 全局 Skills、Plugins 和项目配置。
- 区分 Skill、Plugin、`AGENTS.md` 和项目配置的适用范围。
- 判断哪些能力处于启用状态，哪些只是存在于本地缓存。
- 决定把项目长期规范写入仓库级 `AGENTS.md`，而不是假设存在一个万能架构 Skill。

典型触发场景：

- 查询 Codex Skills、设置、插件或自动化能力。
- 排查 Codex 配置和技能加载问题。
- 选择应该使用 Skill、Plugin、MCP、`AGENTS.md` 还是项目配置。

常见系统位置：

```text
%USERPROFILE%\.codex\skills\.system\openai-docs\SKILL.md
```

迁移方式：

- 它通常随 Codex 提供，不应从另一台电脑手工复制 `.system` 目录。
- 在目标环境使用受支持的 Codex 版本，并确认会话的可用 Skills 列表中包含 `openai-docs`。
- 如果不存在，应通过 Codex 自带更新或官方安装方式恢复，而不是从他人电脑复制缓存。

### 2.2 browser:control-in-app-browser

来源：OpenAI bundled Browser Plugin。

本次用途：

- 准备用真实浏览器检查本地 Django 页面。
- 尝试连接浏览器并检查可用浏览器实例。
- 浏览器实例不可用后，明确停止浏览器验收，没有虚构截图或视觉测试结果。

本次实际结果：

```text
Skill 已加载
Browser Plugin 已启用
可用浏览器实例：0
```

因此，最终改用以下可验证手段完成非视觉验收：

- Django 自动测试。
- HTTP 页面与静态资源状态检查。
- JavaScript 语法检查。
- Web Worker 运行和测试反馈模拟。

常见插件位置：

```text
%USERPROFILE%\.codex\plugins\cache\openai-bundled\browser\<version>\skills\control-in-app-browser\SKILL.md
```

迁移方式：

1. 在目标 Codex 环境安装或启用 Browser Plugin。
2. 新开一个会话，使插件能力重新加载。
3. 确认会话可用 Skills 中出现 `browser:control-in-app-browser`。
4. 打开或连接一个可用浏览器实例。
5. 再执行本地页面截图、响应式布局、键盘操作和控制台错误检查。

不要直接复制带版本号的 `plugins/cache` 目录。缓存路径和版本会变化，也不能代替插件的正确安装与启用状态。

## 3. 本次没有实际调用的 Skills

以下 Skills 在检查中被发现或被推荐，但没有参与本次代码生成。迁移文档必须保留这个区别。

### Build Web Apps Plugin 中的 Skills

```text
frontend-app-builder
frontend-testing-debugging
react-best-practices
shadcn
stripe-best-practices
supabase-postgres-best-practices
```

其中：

- `frontend-app-builder` 适合从零设计前端、Dashboard、游戏和视觉型网站。
- `frontend-testing-debugging` 适合真实页面测试、响应式检查和前端故障排查。
- `react-best-practices` 适合 React/Next.js，不适合机械套用到当前 Django Templates 项目。
- `shadcn` 只适合使用 shadcn/ui 的项目。
- Stripe 与 Supabase Skills 只在项目使用对应服务时启用。

本机检查时，该 Plugin 只存在于缓存，没有在全局配置中启用。因此不能把本次成果归因于这些 Skills。

如果团队未来需要使用，应通过 Codex 的插件安装入口安装并启用 `Build Web Apps`，然后新开会话确认 Skills 真正出现在可用列表中。不要把缓存存在误认为已经启用。

### 其他没有调用的系统 Skills

```text
imagegen
review-agent
skill-creator
skill-installer
plugin-creator
```

- 页面所需视觉全部使用 HTML/CSS 实现，因此没有调用 `imagegen`。
- 本次没有把代码审查委托给 Review Agent，因此没有调用 `review-agent`。
- 没有创建新的通用 Skill，因此没有调用 `skill-creator`。
- 没有安装新 Skill 或创建 Plugin，因此没有调用安装与插件创建 Skills。

## 4. 本次改造真正依赖的项目文件

项目运行不依赖 Codex Skills。Skills 只影响开发过程，网站代码本身可以独立运行。

团队移植项目时，应通过 Git 正常迁移以下内容：

```text
AGENTS.md
docs/ARCHITECTURE.md
docs/CODEX_SKILLS_MIGRATION.md
learning/playground_catalog.py
learning/templates/learning/playground.html
learning/static/learning/css/
learning/static/learning/js/
learning/tests/
```

其中：

- `AGENTS.md` 固化设计、代码、模块和安全规则。
- `docs/ARCHITECTURE.md` 解释模块边界与未来多语言代码执行方案。
- 本文解释开发时使用的 Skills 和环境迁移方式。

## 5. 推荐迁移流程

### 第一步：克隆项目

```powershell
git clone <repository-url>
cd <project-directory>
```

### 第二步：准备项目环境

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_learning_data
```

### 第三步：检查项目规范

确认以下文件存在：

```powershell
Test-Path .\AGENTS.md
Test-Path .\docs\ARCHITECTURE.md
Test-Path .\docs\CODEX_SKILLS_MIGRATION.md
```

### 第四步：准备 Codex 能力

在目标 Codex 环境中确认：

- `openai-docs` 可以使用。
- Browser Plugin 已安装并启用。
- `browser:control-in-app-browser` 出现在可用 Skills 中。
- 如果需要更强的前端设计工作流，再安装并启用 `Build Web Apps`。

启用或安装插件后应新开会话，避免旧会话仍使用加载前的能力清单。

### 第五步：运行质量检查

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
git diff --check
```

启动网站：

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

然后检查：

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/playground/
```

## 6. 不要迁移的文件

不要把整个 `%USERPROFILE%\.codex` 目录复制给其他成员，尤其不要复制：

```text
auth.json
*.sqlite
sessions/
logs/
.sandbox-secrets/
个人 config.toml 中的密钥或私有服务地址
```

这些文件可能包含身份认证、历史会话、本地状态或敏感配置。

也不要提交：

```text
.venv/
db.sqlite3
.env
staticfiles/
本地模型缓存
```

团队真正需要共享的是仓库代码、`AGENTS.md`、架构文档和不含密钥的项目配置。

## 7. 推荐的团队能力组合

对于当前 Django + Templates + Vanilla JavaScript 项目，推荐按需组合：

| 任务 | 推荐能力 |
| --- | --- |
| Codex 配置和 Skills 排查 | `openai-docs` |
| 页面视觉设计 | `frontend-app-builder`，当前为可选项 |
| 本地页面验收 | `browser:control-in-app-browser` |
| UI 故障排查 | `frontend-testing-debugging`，当前为可选项 |
| 项目长期规范 | 仓库级 `AGENTS.md` |
| 架构决策 | `docs/ARCHITECTURE.md` |
| 代码质量 | Django 测试、JavaScript 验证和人工评审 |
| React 专项优化 | 仅在迁移 React/Next.js 后使用 `react-best-practices` |

最重要的原则是：Skill 是否“存在于磁盘”不重要，是否在当前会话真正加载、是否适合当前技术栈、是否完成了可验证的工作，才决定它是否有价值。
