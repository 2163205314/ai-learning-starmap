# AI 学习星图架构说明

## 目标

AI 学习星图不是静态知识展示站，而是一个“理解 → 实验 → 编码 → 构建”的互动学习系统。架构需要同时保证：内容易维护、页面一致、互动模块可独立演进、用户代码不进入 Django 主进程执行。

## 当前技术边界

```text
浏览器
├─ Django Templates：页面结构与服务端内容渲染
├─ CSS Modules：视觉令牌、全局外壳、页面样式
├─ Page Controllers：课程、实验室、代码工坊交互
├─ Web Worker：本地 JavaScript 练习运行与测试
└─ sandbox iframe：HTML/CSS 无脚本、无网络预览
        │ HTTP
        ▼
Django
├─ Page Views：页面编排
├─ API Views：测验、Embedding、Runner 转发等 JSON 接口
├─ Catalog：代码练习等策划内容
├─ Models：课程、概念、路径、测验领域数据
└─ SQLite：本地学习内容存储
        │ 带共享令牌的 HTTP
        ▼
独立 Runner 进程
├─ local：本机工具链 + 每次运行独立临时目录
└─ docker：受限容器 + 每次运行独立临时目录
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

当前版本采用三条执行路径：

1. JavaScript 被发送到临时 Web Worker，超过 2000ms 时由页面终止。
2. HTML/CSS 进入禁用脚本和网络的 sandbox iframe，只用于预览。
3. Python、C、C++、Java 经 Django 校验后转发给独立 Runner 进程；`runner.config` 选择 `local` 或 `docker`。
4. Django 只处理 CSRF、语言白名单、32KB 源码上限、客户端限流和结果转发，绝不执行用户代码。
5. local 模式使用本机 Python/GCC/G++/JDK；每个任务创建随机临时目录，运行结束、失败或超时后删除源码、编译产物与输出文件。它只适合受信代码，不构成恶意代码安全边界。
6. docker 模式使用非 root 用户、只读根文件系统和临时工作目录，不挂载项目、数据库、SSH 或 Django 配置。
7. docker 模式禁止 Runner 外网，清空 Linux capabilities 并启用 `no-new-privileges` 与默认 seccomp；Compose 限制 CPU、512MB 内存和 64 个 PID。
8. 两种模式都限制运行时间和输出大小；支持 `prlimit` 的环境还会限制 CPU 时间、地址空间、打开文件、子进程和输出文件。
9. stdout、stderr、退出码、阶段、耗时与执行模式通过显式 JSON 协议返回，源码不写入日志或数据库。

Web Worker、本地 Runner 和当前 Docker Runner 都不应被描述成可承载任意敌意公网代码的绝对安全边界。公网部署还应演进为异步任务与一次性容器或 microVM：

```text
Browser → Django API → Job Queue → Isolated Runner → Result Store
```

当前 Runner 已落实大部分基础限制；面向敌意公网代码时还必须增加：

- 每次运行使用一次性容器或 microVM，而不是复用长生命周期 Runner 容器。
- 接入 Job Queue 与 Result Store，避免 HTTP 请求长期占用 Web Worker。
- 使用按用户身份和全局容量的分布式限流与配额。
- 增加 AppArmor/SELinux、镜像签名、审计告警和节点级隔离。
- Runner 节点与 Django 数据库、密钥和内部网络完全隔离，只开放单向任务协议。

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
- JavaScript 使用浏览器 Worker；Python、C、C++、Java 使用独立 Runner 进程并由 `runner.config` 选择本地或 Docker 模式；HTML/CSS 使用受限预览。
- 多语言执行只通过独立隔离服务实现，不污染 Django 主应用。
