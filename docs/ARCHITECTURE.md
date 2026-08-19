# AI 学习星图架构说明

## 目标

AI 学习星图不是静态知识展示站，而是一个“理解 → 实验 → 编码 → 构建”的互动学习系统。架构需要同时保证：内容易维护、页面一致、互动模块可独立演进、用户代码不进入 Django 主进程执行。

## 当前技术边界

```text
浏览器
├─ Django Templates：页面结构与服务端内容渲染
├─ CSS Modules：视觉令牌、全局外壳、页面样式
├─ Page Controllers：课程、实验室、代码工坊交互
└─ Web Worker：本地 JavaScript 练习运行与测试
        │
        ▼ HTTP
Django
├─ Page Views：页面编排
├─ API Views：测验、Embedding 等 JSON 接口
├─ Catalog：代码练习等策划内容
├─ Models：课程、概念、路径、测验领域数据
└─ SQLite：本地学习内容存储
```

## 前端模块

### 样式层

- `css/style.css`：现有课程、实验室、项目和词典页面的基础样式。
- `css/tokens.css`：颜色、字体、间距、圆角、阴影和动效令牌。
- `css/shell.css`：全站背景、导航、按钮、容器、页脚和响应式外壳。
- `css/pages/home.css`：首页专属布局。
- `css/pages/playground.css`：代码工坊专属布局。

新页面不能把页面专属规则继续追加到 `style.css`。可复用规则进入 `shell.css`，只在一个页面使用的规则进入 `pages/`。

### JavaScript 层

- `js/app.js`：全站导航等外壳行为。
- `js/courses.js`、`js/lab.js`、`js/main.js`：各页面控制器。
- `js/playground.js`：代码工坊状态、草稿、运行和反馈界面。
- `js/code-runner.worker.js`：代码执行与测试，不操作页面 DOM。

页面控制器之间不直接互相调用。跨页面的学习进度后续应抽成独立 `progress-store.js`，再由各页面消费。

## 代码工坊的安全模型

当前版本只执行浏览器端 JavaScript：

1. 用户代码被发送到临时 Web Worker。
2. Worker 无法操作页面 DOM。
3. 单次运行超过 2000ms 时，主页面终止 Worker。
4. 运行结果和测试结果通过消息返回。
5. 草稿和完成状态只存入浏览器 `localStorage`。
6. 用户代码不会提交给 Django，也不会在 Web 服务器进程中执行。

Web Worker 是适合本地学习的故障隔离方式，但不是运行不可信攻击代码的强安全沙箱。公开部署并支持 Python、Java、C++ 等语言时，必须接入独立执行服务：

```text
Browser → Django API → Job Queue → Isolated Runner → Result Store
```

独立 Runner 至少需要：

- 每次运行使用一次性容器或 microVM。
- 禁止外网，文件系统只读，只开放临时工作目录。
- 限制 CPU、内存、进程数、输出大小和执行时间。
- 使用非 root 用户，启用 seccomp/AppArmor 等系统策略。
- 对提交频率做用户级限流，记录任务状态而不记录敏感代码。
- Runner 与 Django 数据库、密钥、内部网络完全隔离。

绝不能在 Django View 中使用 `exec`、`eval`、`subprocess` 直接运行用户代码。

## 后端模块演进

当前 `learning/views.py` 规模尚小，可以保留。出现下列任一情况时再拆分，避免为了目录而目录：

- 页面视图和 API 视图合计超过约 400 行。
- 新增用户进度、作业提交或代码任务 API。
- Embedding、代码执行任务出现重试、缓存或异步状态。

建议届时演进为：

```text
learning/
├─ views/
│  ├─ pages.py
│  └─ api.py
├─ services/
│  ├─ embeddings.py
│  ├─ progress.py
│  └─ code_jobs.py
├─ repositories/
│  └─ learning_content.py
└─ tests/
```

View 只做输入校验、权限判断、调用 Service 和组织响应；业务规则放入 Service，查询组合放入 Repository。简单查询不必机械地增加抽象层。

## 质量门槛

每次改动至少执行：

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
```

涉及页面时还应检查：

- 360px、768px、1440px 三种宽度。
- 键盘可操作性与可见焦点。
- 浏览器控制台无错误。
- 动效遵循 `prefers-reduced-motion`。
- 页面无横向溢出，长代码可滚动。

## 核心决策

- 保留 Django Templates + 原生 JavaScript：当前交互复杂度不需要引入 React 构建链。
- 先建立设计令牌和页面模块，不一次性重写所有旧 CSS。
- 代码工坊第一阶段使用 Worker，优先形成学习反馈闭环。
- 多语言执行只通过独立隔离服务实现，不污染 Django 主应用。
