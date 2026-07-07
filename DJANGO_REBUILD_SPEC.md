# AI 学习星图 Django 重构实施规格书

## 目标

请使用 **Python + Django + HTML/CSS/JavaScript + SQLite** 从零构建一个本地可运行的 AI 学习网站。

最终效果是一个本地可运行的 Django 学习网站，用于把保留数据文件中的 AI 学习知识，以直观、详细、有趣的网页形式展示出来。

不要使用 React、Vite、Tailwind、前后端分离框架。前端只使用 Django Template、原生 HTML、CSS、JavaScript。

## 必须保留的数据文件

重构前如果需要删除旧代码，只允许删除框架代码、构建产物、缓存、依赖目录和旧前端/后端实现。以下文件必须保留，作为新 Django 项目的唯一内容来源：

| 文件 | 作用 | 是否必须 |
|---|---|---|
| `conversations.json` | 原始 DeepSeek 学习交互记录，用于追溯知识来源 | 必须 |
| `rebuild_assets/knowledge.json` | 已整理好的模块、卡片、章节、概念、路径、测验结构化数据 | 必须 |
| `rebuild_assets/knowledge.ts` | 结构化数据的 TypeScript 源备份，仅用于人工核对 | 建议保留 |
| `DJANGO_REBUILD_SPEC.md` | 本规格书，重构时的实施依据 | 必须 |

如果只能保留两个文件，必须保留：

```text
conversations.json
rebuild_assets/knowledge.json
```

`knowledge.json` 是新 Django 项目导入 SQLite 的核心数据源。不要依赖任何 React、Vite、FastAPI、Node.js 文件。

## 数据源契约

`rebuild_assets/knowledge.json` 应被视为稳定输入文件。Django 管理命令 `seed_learning_data` 必须优先读取它并写入 SQLite。

期望 JSON 顶层结构：

```json
{
  "knowledgeCards": [],
  "concepts": [],
  "learningPaths": [],
  "quizzes": [],
  "moduleMeta": {}
}
```

### knowledgeCards 数据结构

每个知识卡片至少包含：

```json
{
  "id": "agent-memory",
  "module": "agent",
  "title": "记忆系统：让 Agent 拥有经验",
  "difficulty": "进阶",
  "summary": "卡片摘要",
  "keyTakeaways": ["要点 1", "要点 2"],
  "sections": [
    {
      "title": "章节标题",
      "content": "章节正文",
      "codeExample": "可选代码示例",
      "visualType": "可选视觉类型"
    }
  ]
}
```

字段映射规则：

- `id` → `KnowledgeCard.card_id`
- `module` → `Module.key`
- `keyTakeaways` → `KnowledgeCard.key_takeaways`
- `sections` → 多条 `KnowledgeSection`
- `codeExample` → `KnowledgeSection.code_example`
- `visualType` → `KnowledgeSection.visual_type`

### concepts 数据结构

每个概念至少包含：

```json
{
  "id": "c-memory",
  "name": "记忆系统",
  "category": "应用",
  "difficulty": "进阶",
  "explanation": "概念解释",
  "relatedIds": ["c-agent", "c-rag"]
}
```

字段映射规则：

- `id` → `Concept.concept_id`
- `relatedIds` → `Concept.related` 自关联，多对多关系

导入时必须先创建所有 Concept，再建立 `relatedIds` 关系，避免关联对象不存在。

### learningPaths 数据结构

每条学习路径至少包含：

```json
{
  "id": "path-agent",
  "title": "Agent 入门路径",
  "description": "路径说明",
  "icon": "🤖",
  "cardIds": ["agent-intro", "agent-tools", "agent-memory"]
}
```

字段映射规则：

- `id` → `LearningPath.path_id`
- `cardIds` → 学习路径与 KnowledgeCard 的有序关联

必须通过中间表保存卡片顺序，不要丢失路径内顺序。

### quizzes 数据结构

每道题至少包含：

```json
{
  "id": "q-memory-storage",
  "question": "题干",
  "options": ["A", "B", "C", "D"],
  "correct": 1,
  "explanation": "答案解析",
  "conceptIds": ["c-memory"]
}
```

字段映射规则：

- `id` → `QuizQuestion.quiz_id`
- `correct` 使用 0-based 索引
- `conceptIds` → `QuizQuestion.concepts` 多对多关系

### 当前备份数据规模

当前 `rebuild_assets/knowledge.json` 已备份并包含：

| 类型 | 数量 |
|---|---:|
| 知识卡片 | 18 |
| 概念 | 26 |
| 学习路径 | 4 |
| 测验题 | 13 |
| 模块 | 5 |

导入完成后，Django Admin 中这些数据都应可见。

### 当前备份模块清单

| key | 名称 |
|---|---|
| `agent` | Agent 智能体 |
| `rag` | RAG 检索增强 |
| `embedding` | Embedding 向量化 |
| `transformer` | Transformer 原理 |
| `engineering` | 工程部署 |

### 当前备份知识卡片清单

| 模块 | card_id | 标题 |
|---|---|---|
| agent | `agent-intro` | Agent 本质：自主决策循环 |
| agent | `agent-tools` | 工具调用：给 Agent 装上手脚 |
| agent | `agent-memory` | 记忆系统：让 Agent 拥有“经验” |
| agent | `agent-knowledgemap` | Agent 开发者完整技能树 |
| rag | `rag-intro` | RAG：给 LLM 装上外挂知识库 |
| rag | `rag-advanced` | RAG 高级技术：多路召回与重排序 |
| rag | `rag-chunk` | 文档切分：Chunk 设计的艺术 |
| rag | `rag-customer-service` | 实战：智能客服 RAG 系统 |
| embedding | `embedding-intro` | Embedding：让机器“理解”语义 |
| embedding | `embedding-deep` | Embedding 深入：模型原理与优化 |
| embedding | `embedding-semantic-theory` | 词向量为什么能表示语义 |
| embedding | `embedding-pretrained-model` | 预训练语义模型揭秘 |
| transformer | `transformer-intro` | Transformer：现代 AI 的基石 |
| transformer | `attention-mechanism` | 自注意力：Transformer 的灵魂 |
| transformer | `positional-encoding` | 位置编码与 Transformer 细节 |
| engineering | `engineering-async` | Agent 异步编程与并发 |
| engineering | `engineering-deploy` | 生产部署：FastAPI + 流式输出 |
| engineering | `engineering-monitoring` | 可观测性：LangSmith / LangFuse |

### 当前备份测验清单

| quiz_id | 题目 |
|---|---|
| `q1` | Agent 与普通聊天机器人的核心区别是什么？ |
| `q2` | RAG 的核心流程顺序是？ |
| `q3` | 对自注意力机制来说，以下哪个说法正确？ |
| `q4` | 向量数据库每次查询都需要重新向量化所有文档吗？ |
| `q5` | BM25 和向量检索的区别是？ |
| `q6` | 在 RAG 中，chunk_overlap 的主要作用是？ |
| `q8` | 重排序（Reranker）应该在哪个阶段使用？ |
| `q9` | 为什么“猫”和“狗”的向量相似度远高于“猫”和“汽车”？ |
| `q12` | Agent 中使用 asyncio.gather() 的主要目的是？ |
| `q13` | SSE（Server-Sent Events）和 WebSocket 的主要区别是什么？ |
| `q14` | 为什么 RAG 使用“冻结”的 Embedding 模型，而不是微调它？ |
| `q15` | Agent 的长期记忆为什么通常不能只用向量数据库？ |
| `q16` | 哪些内容最适合写入 Agent 的长期记忆？ |

### moduleMeta 数据结构

模块元信息可能是对象字典：

```json
{
  "agent": {
    "name": "Agent 智能体",
    "icon": "🤖",
    "color": "#f0c040"
  }
}
```

如果 `knowledge.json` 中没有 `sort_order`，按以下顺序写入：

1. `agent`
2. `rag`
3. `embedding`
4. `transformer`
5. `engineering`

## 技术栈要求

- 后端：Python 3.12、Django 5.x
- 数据库：SQLite
- 前端：Django Templates + 原生 HTML/CSS/JS
- 图标：优先用 emoji 或内联 SVG，不依赖外部图标库
- 样式：自写 CSS，深空主题、玻璃卡片、发光按钮、星空背景
- Embedding：可选功能，优先保留接口结构；如果环境允许，可接入 `sentence-transformers` CPU 版
- 启动方式：`python manage.py runserver`

## 项目定位

项目名称：**AI 学习星图**

项目用途：把 AI 学习交互内容整理成结构化课程网页，帮助用户学习：

- Agent 智能体
- RAG 检索增强
- Embedding 向量化
- Transformer 原理
- 工程部署

不需要视觉注意力、YOLO、CNN 相关模块。

## 目标页面

需要实现 5 个页面：

| 页面 | URL | 功能 |
|---|---|---|
| 首页 | `/` | 星空首页、学习路径、知识模块入口、概念星图 |
| 课程学习 | `/courses/` | 按模块浏览知识卡片、展开章节、查看代码示例、完成测验 |
| 互动实验室 | `/lab/` | RAG 流程、Chunk 调节、Embedding 相似度、Attention 拆解 |
| 项目实战 | `/project/` | 智能客服 RAG 项目 6 步构建、Token 预算、延迟估算 |
| 概念词典 | `/glossary/` | 概念搜索、分类筛选、关联概念跳转 |

## 推荐目录结构

```text
ai_learning_django/
├── manage.py
├── requirements.txt
├── README.md
├── db.sqlite3
├── conversations.json
├── ai_learning/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── learning/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── urls.py
│   ├── views.py
│   ├── services.py
│   ├── management/
│   │   └── commands/
│   │       ├── seed_learning_data.py
│   │       └── import_conversations.py
│   ├── templates/
│   │   └── learning/
│   │       ├── base.html
│   │       ├── home.html
│   │       ├── courses.html
│   │       ├── lab.html
│   │       ├── project.html
│   │       └── glossary.html
│   └── static/
│       └── learning/
│           ├── css/
│           │   └── style.css
│           └── js/
│               ├── main.js
│               ├── courses.js
│               ├── lab.js
│               └── glossary.js
```

## 数据模型

请使用 Django ORM + SQLite 存储所有学习内容。

### Module

知识模块。

字段：

- `key`：字符串，唯一，例如 `agent`、`rag`、`embedding`、`transformer`、`engineering`
- `name`：模块中文名
- `icon`：emoji 或图标名
- `color`：主题色，例如 `#f0c040`
- `sort_order`：排序

### KnowledgeCard

知识卡片。

字段：

- `card_id`：字符串，唯一，例如 `agent-memory`
- `module`：外键 Module
- `title`：标题
- `difficulty`：入门 / 进阶 / 深入
- `summary`：摘要
- `key_takeaways`：JSONField，字符串数组
- `sort_order`：排序

### KnowledgeSection

卡片章节。

字段：

- `card`：外键 KnowledgeCard
- `title`：章节标题
- `content`：正文，支持换行
- `code_example`：代码示例，可为空
- `visual_type`：flow / comparison / architecture / code，可为空
- `sort_order`：排序

### Concept

概念词典。

字段：

- `concept_id`：字符串，唯一，例如 `c-memory`
- `name`：概念名称
- `category`：应用 / 检索 / 原理 / 工程
- `difficulty`：入门 / 进阶 / 深入
- `explanation`：解释
- `related`：ManyToManyField，自关联，可为空

### LearningPath

学习路径。

字段：

- `path_id`：字符串，唯一，例如 `path-agent`
- `title`：标题
- `description`：描述
- `icon`：emoji 或图标名
- `cards`：ManyToManyField KnowledgeCard，通过中间表排序
- `sort_order`：排序

### QuizQuestion

测验题。

字段：

- `quiz_id`：字符串，唯一
- `question`：题干
- `options`：JSONField，4 个选项
- `correct`：正确选项索引，0-based
- `explanation`：解析
- `concepts`：ManyToManyField Concept

### 可直接参考的 `learning/models.py`

```python
from django.db import models


class Module(models.Model):
    key = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    icon = models.CharField(max_length=40, blank=True)
    color = models.CharField(max_length=20, default="#40a0f0")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "key"]

    def __str__(self):
        return self.name


class KnowledgeCard(models.Model):
    card_id = models.SlugField(max_length=80, unique=True)
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="cards")
    title = models.CharField(max_length=160)
    difficulty = models.CharField(max_length=20)
    summary = models.TextField()
    key_takeaways = models.JSONField(default=list, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["module__sort_order", "sort_order", "card_id"]

    def __str__(self):
        return self.title


class KnowledgeSection(models.Model):
    card = models.ForeignKey(KnowledgeCard, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=160)
    content = models.TextField()
    code_example = models.TextField(blank=True)
    visual_type = models.CharField(max_length=40, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.card.title} - {self.title}"


class Concept(models.Model):
    concept_id = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=40)
    difficulty = models.CharField(max_length=20)
    explanation = models.TextField()
    related = models.ManyToManyField("self", blank=True, symmetrical=False)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class LearningPath(models.Model):
    path_id = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=120)
    description = models.TextField()
    icon = models.CharField(max_length=40, blank=True)
    cards = models.ManyToManyField(KnowledgeCard, through="LearningPathCard", related_name="learning_paths")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "path_id"]

    def __str__(self):
        return self.title


class LearningPathCard(models.Model):
    path = models.ForeignKey(LearningPath, on_delete=models.CASCADE)
    card = models.ForeignKey(KnowledgeCard, on_delete=models.CASCADE)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]
        unique_together = [("path", "card")]


class QuizQuestion(models.Model):
    quiz_id = models.SlugField(max_length=80, unique=True)
    question = models.TextField()
    options = models.JSONField(default=list)
    correct = models.PositiveIntegerField(default=0)
    explanation = models.TextField()
    concepts = models.ManyToManyField(Concept, blank=True, related_name="quiz_questions")

    class Meta:
        ordering = ["quiz_id"]

    def __str__(self):
        return self.question[:60]
```

### 可直接参考的 `learning/admin.py`

```python
from django.contrib import admin
from .models import Concept, KnowledgeCard, KnowledgeSection, LearningPath, LearningPathCard, Module, QuizQuestion


class KnowledgeSectionInline(admin.TabularInline):
    model = KnowledgeSection
    extra = 0


@admin.register(KnowledgeCard)
class KnowledgeCardAdmin(admin.ModelAdmin):
    list_display = ("card_id", "title", "module", "difficulty", "sort_order")
    list_filter = ("module", "difficulty")
    search_fields = ("card_id", "title", "summary")
    inlines = [KnowledgeSectionInline]


class LearningPathCardInline(admin.TabularInline):
    model = LearningPathCard
    extra = 0


@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    list_display = ("path_id", "title", "sort_order")
    search_fields = ("path_id", "title", "description")
    inlines = [LearningPathCardInline]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "icon", "color", "sort_order")
    search_fields = ("key", "name")


@admin.register(Concept)
class ConceptAdmin(admin.ModelAdmin):
    list_display = ("concept_id", "name", "category", "difficulty")
    list_filter = ("category", "difficulty")
    search_fields = ("concept_id", "name", "explanation")
    filter_horizontal = ("related",)


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ("quiz_id", "question", "correct")
    search_fields = ("quiz_id", "question", "explanation")
    filter_horizontal = ("concepts",)
```

### 可直接参考的数据导入逻辑

`learning/management/commands/seed_learning_data.py` 必须具备以下行为：

```python
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from learning.models import Concept, KnowledgeCard, KnowledgeSection, LearningPath, LearningPathCard, Module, QuizQuestion


MODULE_ORDER = ["agent", "rag", "embedding", "transformer", "engineering"]


class Command(BaseCommand):
    help = "Import AI learning data from rebuild_assets/knowledge.json into SQLite."

    def add_arguments(self, parser):
        parser.add_argument("--file", default="rebuild_assets/knowledge.json")

    def handle(self, *args, **options):
        data_path = Path(options["file"])
        if not data_path.exists():
            data_path = Path.cwd() / options["file"]
        data = json.loads(data_path.read_text(encoding="utf-8"))

        LearningPathCard.objects.all().delete()
        LearningPath.objects.all().delete()
        QuizQuestion.objects.all().delete()
        KnowledgeSection.objects.all().delete()
        KnowledgeCard.objects.all().delete()
        Concept.objects.all().delete()
        Module.objects.all().delete()

        module_meta = data.get("moduleMeta", {})
        modules = {}
        for index, key in enumerate(MODULE_ORDER):
            meta = module_meta.get(key, {})
            modules[key] = Module.objects.create(
                key=key,
                name=meta.get("name", key),
                icon=meta.get("icon", ""),
                color=meta.get("color", "#40a0f0"),
                sort_order=index,
            )

        cards = {}
        for card_index, item in enumerate(data.get("knowledgeCards", [])):
            module_key = item.get("module")
            if module_key not in modules:
                continue
            card = KnowledgeCard.objects.create(
                card_id=item["id"],
                module=modules[module_key],
                title=item.get("title", ""),
                difficulty=item.get("difficulty", "入门"),
                summary=item.get("summary", ""),
                key_takeaways=item.get("keyTakeaways", []),
                sort_order=card_index,
            )
            cards[card.card_id] = card
            for section_index, section in enumerate(item.get("sections", [])):
                KnowledgeSection.objects.create(
                    card=card,
                    title=section.get("title", ""),
                    content=section.get("content", ""),
                    code_example=section.get("codeExample", ""),
                    visual_type=section.get("visualType", ""),
                    sort_order=section_index,
                )

        concepts = {}
        for item in data.get("concepts", []):
            concept = Concept.objects.create(
                concept_id=item["id"],
                name=item.get("name", ""),
                category=item.get("category", "应用"),
                difficulty=item.get("difficulty", "入门"),
                explanation=item.get("explanation", ""),
            )
            concepts[concept.concept_id] = concept

        for item in data.get("concepts", []):
            concept = concepts.get(item["id"])
            for related_id in item.get("relatedIds", []):
                related = concepts.get(related_id)
                if concept and related:
                    concept.related.add(related)

        for path_index, item in enumerate(data.get("learningPaths", [])):
            path = LearningPath.objects.create(
                path_id=item["id"],
                title=item.get("title", ""),
                description=item.get("description", ""),
                icon=item.get("icon", ""),
                sort_order=path_index,
            )
            for card_index, card_id in enumerate(item.get("cardIds", [])):
                card = cards.get(card_id)
                if card:
                    LearningPathCard.objects.create(path=path, card=card, sort_order=card_index)

        for item in data.get("quizzes", []):
            quiz = QuizQuestion.objects.create(
                quiz_id=item["id"],
                question=item.get("question", ""),
                options=item.get("options", []),
                correct=item.get("correct", 0),
                explanation=item.get("explanation", ""),
            )
            for concept_id in item.get("conceptIds", []):
                concept = concepts.get(concept_id)
                if concept:
                    quiz.concepts.add(concept)

        self.stdout.write(self.style.SUCCESS("AI learning data imported successfully."))
```

## 必须包含的核心内容

请从 `rebuild_assets/knowledge.json` 的结构化知识中导入内容，至少包含以下卡片主题。

### Agent 模块

- Agent 入门：LLM + Tools + Memory + Planning
- 工具调用：Function Calling、多轮工具调用、错误处理
- 记忆系统：工作记忆、短期记忆、长期记忆、存储方式、写入、检索、压缩、遗忘、隐私过滤
- Agent 技能树：Python、LLM、Prompt、RAG、部署、评估

### RAG 模块

- RAG 基础流程：加载、切分、向量化、检索、生成
- Chunking：chunk_size、chunk_overlap、边界断裂问题
- 高级检索：BM25、向量检索、混合检索、Reranker
- 智能客服 RAG 案例

### Embedding 模块

- Embedding 基础：文本到向量
- 余弦相似度
- 分布假说：为什么猫和狗更相似
- 冻结模型与可更新知识库
- BPE 子词处理未知词

### Transformer 模块

- Transformer 为什么重要
- Self-Attention
- Q/K/V
- 位置编码
- FFN
- 残差连接与层归一化

### 工程部署模块

- Python 异步编程：asyncio、gather、create_task
- FastAPI / Django 服务化思想
- SSE 流式输出
- 可观测性：日志、链路追踪、成本追踪、LangSmith、LangFuse

## 页面详细要求

### 1. 首页 `/`

首页风格必须符合以下视觉方向：

- 深空蓝黑背景
- 星光粒子背景
- 金色渐变大标题：AI 学习星图
- 副标题：从 Agent 到 RAG，再到 Transformer 原理
- 两个按钮：开始学习、探索概念
- 学习路径卡片
- 知识模块入口
- 概念星图

概念星图节点：

- Agent
- RAG
- Embedding
- Transformer
- Attention
- 记忆系统

连线关系：

- Agent → RAG
- Agent → 记忆系统
- Agent → Transformer
- RAG → Embedding
- Embedding → Transformer
- Transformer → Attention

实现方式：

- 可以用 SVG 手写轨道图
- 不要求复杂图谱库
- 节点颜色应与模块主题色一致

### 2. 课程页 `/courses/`

支持查询参数：

- `/courses/?module=agent`
- `/courses/?module=rag`
- `/courses/?module=embedding`
- `/courses/?module=transformer`
- `/courses/?module=engineering`
- `/courses/?path=path-agent`

页面布局：

- 左侧：模块导航
- 中间：知识卡片列表
- 右侧：学习进度

知识卡片要求：

- 展示标题、摘要、难度标签、关键要点
- 点击展开章节
- 章节支持收起/展开
- 代码示例显示为深色代码块
- 正文保留换行

测验要求：

- 每个模块显示相关测验
- 点击选项后立即显示对错
- 正确选项绿色，错误选项红色
- 显示解析
- 进度栏统计已看卡片、已答题、答对数量

### 3. 互动实验室 `/lab/`

使用原生 JavaScript 实现标签页切换。

标签页：

- RAG 流程模拟器
- Chunk 参数调节器
- Embedding 相似度实验室
- Attention 公式拆解器

#### RAG 流程模拟器

用 SVG 展示流程：

加载 → 切分 → 向量化 → 检索 → 重排序 → 生成

点击每个节点显示详情。

#### Chunk 参数调节器

两个滑块：

- chunk_size，范围 100-1000
- chunk_overlap，范围 0-200

实时展示：

- 文档长度
- 切块数量
- 平均块长度
- 前几个 chunk 预览

#### Embedding 相似度实验室

预设词汇对：

- 猫 ↔ 狗
- 猫 ↔ 汽车
- 退款 ↔ 退货
- 苹果 ↔ 香蕉
- 北京 ↔ 上海
- Python ↔ Java
- 天气 ↔ 雨伞
- 快乐 ↔ 悲伤

自定义输入两个词，点击计算。

如果接入 `sentence-transformers`：

- 使用 `paraphrase-multilingual-MiniLM-L12-v2`
- 返回余弦相似度
- 显示向量维度和前 8 维预览

如果不接入模型：

- 使用后端 Python 中的简化语义词库或字符相似度兜底
- 页面要明确标注“模拟结果”

#### Attention 公式拆解器

分四步展示：

1. QKᵀ
2. 除以 √dₖ
3. Softmax
4. 乘以 V

用小矩阵或卡片方式解释每一步。

### 4. 项目实战 `/project/`

主题：智能客服知识库问答系统。

展示 6 个步骤：

1. 文档准备
2. 文档切分
3. 向量化存储
4. 多路检索
5. 重排序
6. Agent 回答

要求：

- 每步有标题、子标题、状态
- 状态可点击切换：待完成 → 进行中 → 已完成
- 每步可展开详细内容
- 右侧显示 Token 预算仪表盘
- 右侧显示延迟估算条形图
- 显示优化建议

Token 预算：

| 项目 | tokens | 颜色 |
|---|---:|---|
| 系统 Prompt | 400 | 紫色 |
| 对话历史 | 800 | 蓝色 |
| 检索上下文 | 1200 | 青色 |
| 用户问题 | 100 | 橙色 |
| 生成预留 | 500 | 粉色 |

最大 token：4096。

延迟估算：

| 阶段 | min | max |
|---|---:|---:|
| Embedding | 200 | 500 |
| BM25 检索 | 50 | 150 |
| 向量检索 | 100 | 300 |
| Reranker | 300 | 800 |
| LLM 生成 | 1500 | 4000 |

### 5. 概念词典 `/glossary/`

功能：

- 搜索概念名称、解释、分类、难度
- 分类筛选：全部、应用、检索、原理、工程
- 概念卡片展示名称、分类、难度、解释
- 点击卡片展开关联概念
- 点击关联概念跳转并滚动到对应卡片

必须包含概念：

- Agent
- LLM
- 工具调用
- 记忆系统
- 任务规划
- RAG
- Embedding
- 向量数据库
- BM25
- Reranker
- 混合检索
- Transformer
- Self-Attention
- Q/K/V
- 位置编码
- FFN
- 残差连接与层归一化
- Chunking
- 余弦相似度
- 推理
- 幻觉
- asyncio
- SSE
- 可观测性
- 分布假说
- 预训练模型

## 样式规范

整体风格：深空科技感。

基础颜色：

```css
:root {
  --space-950: #020617;
  --space-900: #0a0e27;
  --text-main: #c8d6e5;
  --text-muted: #64748b;
  --gold: #f0c040;
  --cyan: #40f0c0;
  --blue: #40a0f0;
  --purple: #a040f0;
  --pink: #f040a0;
  --orange: #f0a040;
}
```

必须实现的 CSS 组件：

- `.glass-card`：半透明玻璃卡片，边框、模糊、阴影
- `.glow-btn`：发光按钮
- `.code-block`：深色代码块，等宽字体
- `.progress-bar`：渐变进度条
- `.star`：星光粒子
- `.card-selected`：选中卡片高亮

响应式要求：

- 桌面端课程页三栏布局
- 平板端两栏或单栏
- 手机端单栏，导航按钮可换行

## JavaScript 交互要求

只使用原生 JS。

必须实现：

- 课程卡片展开/收起
- 章节展开/收起
- 测验选择与结果展示
- Lab 标签切换
- Chunk 滑块实时计算
- RAG 节点点击显示详情
- 项目步骤状态切换
- 概念搜索与筛选
- 关联概念点击滚动

## 后端视图建议

使用普通 Django views 即可，不强制 Django REST Framework。

建议 URL：

```python
urlpatterns = [
    path('', views.home, name='home'),
    path('courses/', views.courses, name='courses'),
    path('lab/', views.lab, name='lab'),
    path('project/', views.project, name='project'),
    path('glossary/', views.glossary, name='glossary'),
    path('api/quiz/check/', views.check_quiz, name='check_quiz'),
    path('api/embedding/similarity/', views.embedding_similarity, name='embedding_similarity'),
]
```

页面渲染数据应尽量在 Django view 中查询并传入模板，而不是在模板里写复杂逻辑。

### `requirements.txt` 建议内容

基础版本：

```text
Django>=5.0,<6.0
```

可选真实 Embedding 版本不要默认写入基础 `requirements.txt`，建议单独放到 `requirements-ml.txt`：

```text
sentence-transformers==3.3.1
```

PyTorch CPU 版安装命令必须单独写在 README：

```powershell
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
```

### `ai_learning/settings.py` 关键要求

- `INSTALLED_APPS` 必须包含 `learning`。
- `LANGUAGE_CODE = "zh-hans"`。
- `TIME_ZONE = "Asia/Shanghai"`。
- `STATIC_URL = "static/"`。
- 开发阶段使用 SQLite 默认配置即可。
- 模板使用 Django 默认模板引擎。

### `ai_learning/urls.py` 关键要求

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("learning.urls")),
]
```

### 可直接参考的 `learning/views.py`

```python
import math
from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from .models import Concept, KnowledgeCard, KnowledgeSection, LearningPath, Module, QuizQuestion


def home(request):
    modules = Module.objects.all()
    paths = LearningPath.objects.prefetch_related("cards")
    concepts = Concept.objects.filter(concept_id__in=[
        "c-agent", "c-rag", "c-embedding", "c-transformer", "c-attention", "c-memory"
    ])
    return render(request, "learning/home.html", {
        "modules": modules,
        "paths": paths,
        "star_concepts": concepts,
    })


def courses(request):
    modules = Module.objects.all()
    selected_module = request.GET.get("module") or "agent"
    selected_path = request.GET.get("path")
    cards_query = KnowledgeCard.objects.select_related("module").prefetch_related("sections")

    if selected_path:
        path = LearningPath.objects.filter(path_id=selected_path).first()
        cards = list(path.cards.prefetch_related("sections")) if path else []
        title = path.title if path else "学习路径"
    else:
        path = None
        cards = cards_query.filter(module__key=selected_module)
        title = Module.objects.filter(key=selected_module).values_list("name", flat=True).first() or "课程学习"

    concept_ids = Concept.objects.filter(quiz_questions__isnull=False).values_list("concept_id", flat=True).distinct()
    quizzes = QuizQuestion.objects.filter(concepts__concept_id__in=concept_ids).prefetch_related("concepts").distinct()

    return render(request, "learning/courses.html", {
        "modules": modules,
        "cards": cards,
        "quizzes": quizzes,
        "selected_module": selected_module,
        "selected_path": selected_path,
        "page_title": title,
    })


def lab(request):
    return render(request, "learning/lab.html")


def project(request):
    return render(request, "learning/project.html")


def glossary(request):
    query = request.GET.get("q", "").strip()
    category = request.GET.get("category", "all")
    concepts = Concept.objects.prefetch_related("related")
    if category != "all":
        concepts = concepts.filter(category=category)
    if query:
        concepts = concepts.filter(
            Q(name__icontains=query) |
            Q(explanation__icontains=query) |
            Q(category__icontains=query) |
            Q(difficulty__icontains=query)
        )
    return render(request, "learning/glossary.html", {
        "concepts": concepts,
        "query": query,
        "category": category,
        "categories": ["应用", "检索", "原理", "工程"],
    })


@require_POST
def check_quiz(request):
    quiz_id = request.POST.get("quiz_id")
    selected = int(request.POST.get("selected", -1))
    quiz = QuizQuestion.objects.get(quiz_id=quiz_id)
    return JsonResponse({
        "correct": selected == quiz.correct,
        "correctIndex": quiz.correct,
        "explanation": quiz.explanation,
    })


@require_GET
def embedding_similarity(request):
    a = request.GET.get("a", "").strip()
    b = request.GET.get("b", "").strip()
    score, method, details = calculate_similarity(a, b)
    return JsonResponse({
        "a": a,
        "b": b,
        "score": score,
        "method": method,
        "details": details,
    })


SEMANTIC_GROUPS = {
    "宠物": {"猫", "狗", "兔子", "仓鼠"},
    "水果": {"苹果", "香蕉", "葡萄", "橙子"},
    "城市": {"北京", "上海", "广州", "深圳"},
    "编程语言": {"Python", "Java", "JavaScript", "Go"},
    "电商": {"退款", "退货", "换货", "订单"},
    "天气": {"天气", "下雨", "雨伞", "晴天"},
    "情绪": {"快乐", "悲伤", "开心", "难过"},
}


def calculate_similarity(a, b):
    if not a or not b:
        return 0, "empty", []
    try:
        from sentence_transformers import SentenceTransformer
        from sentence_transformers.util import cos_sim
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        embeddings = model.encode([a, b])
        score = float(cos_sim(embeddings[0], embeddings[1])[0][0])
        return round(score * 100, 2), "sentence-transformers", {
            "dimension": len(embeddings[0]),
            "vectorPreviewA": [round(float(x), 4) for x in embeddings[0][:8]],
            "vectorPreviewB": [round(float(x), 4) for x in embeddings[1][:8]],
        }
    except Exception:
        return fallback_similarity(a, b)


def fallback_similarity(a, b):
    for words in SEMANTIC_GROUPS.values():
        if a in words and b in words:
            return 72, "simulated-semantic", {"reason": "同一语义类别"}
    set_a = set(a.lower())
    set_b = set(b.lower())
    union = set_a | set_b
    score = 0 if not union else len(set_a & set_b) / len(union) * 100
    return round(score, 2), "character-fallback", {"reason": "字符集合 Jaccard 相似度"}
```

注意：真实项目中 `SentenceTransformer` 模型应做全局懒加载缓存，避免每次请求重复加载。上方代码为了说明逻辑而保持简单。

### 课程页测验筛选建议

如果要让测验更精准地跟随模块变化，可以在导入时增加 `QuizQuestion.module` 字段；如果不新增字段，则按概念关系筛选：

- Agent 模块：包含 `c-agent`、`c-tool`、`c-memory`、`c-planning` 的题
- RAG 模块：包含 `c-rag`、`c-chunk`、`c-bm25`、`c-rerank`、`c-hybrid` 的题
- Embedding 模块：包含 `c-embedding`、`c-similarity`、`c-distributional`、`c-pretrained` 的题
- Transformer 模块：包含 `c-transformer`、`c-attention`、`c-qkv`、`c-encoding`、`c-ffn`、`c-residual` 的题
- Engineering 模块：包含 `c-async`、`c-sse`、`c-observability` 的题

## 数据初始化

必须提供管理命令：

```powershell
python manage.py seed_learning_data
```

作用：

- 清空旧数据
- 创建 5 个模块
- 创建知识卡片、章节、概念、学习路径、测验
- 建立概念关联
- 建立学习路径与卡片关系

可选命令：

```powershell
python manage.py import_conversations --file conversations.json
```

作用：

- 读取原始 `conversations.json`
- 生成或辅助更新结构化知识
- 如果实现复杂，可先保留命令框架和说明

## README 必须写清楚

新项目 README 需要包含：

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_learning_data
python manage.py runserver
```

访问：

```text
http://127.0.0.1:8000/
```

如果要安装真实 Embedding：

```powershell
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
pip install sentence-transformers==3.3.1
```

## 验收标准

必须满足：

- `python manage.py runserver` 能正常启动
- 首页、课程页、实验室、项目实战、概念词典均可访问
- 不依赖 React / Vite / Node.js
- 数据存储在 SQLite 中
- 后台可通过 Django Admin 管理模块、卡片、章节、概念、路径、测验
- 课程页能按模块筛选
- 记忆系统内容必须详细，包含存储方式、写入、检索、压缩、遗忘、隐私过滤
- 概念词典能搜索和筛选
- 测验可以作答并显示解析
- 页面风格满足要求：深空背景、玻璃卡片、霓虹色、星图感
- 移动端可正常阅读

## 禁止事项

- 不要使用 React、Vite、Tailwind
- 不要把所有内容硬编码在 HTML 一个文件里
- 不要删除 `conversations.json`
- 不要重新加入视觉注意力、YOLO、CNN 模块
- 不要把敏感信息写入仓库
- 不要要求用户手动编辑数据库才能看到内容

## 实现优先级

1. Django 项目骨架、模型、迁移、管理命令
2. 种子数据完整导入 SQLite
3. 首页、课程页、概念词典
4. 互动实验室
5. 项目实战
6. Embedding 可选真实模型
7. README 和验收测试

## 最终交付

交付一个完整 Django 项目，用户只需要执行：

```powershell
python manage.py migrate
python manage.py seed_learning_data
python manage.py runserver
```

然后打开：

```text
http://127.0.0.1:8000/
```

即可看到完整可用的 AI 学习星图。
