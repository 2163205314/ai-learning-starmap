// 学习数据层 - 从 conversations.json 提炼的结构化知识

export interface KnowledgeCard {
  id: string
  title: string
  module: 'agent' | 'rag' | 'embedding' | 'transformer' | 'engineering'
  difficulty: '入门' | '进阶' | '深入'
  summary: string
  sections: KnowledgeSection[]
  keyTakeaways: string[]
}

export interface KnowledgeSection {
  title: string
  content: string
  codeExample?: string
  visualType?: 'flow' | 'comparison' | 'architecture' | 'code'
}

export interface Concept {
  id: string
  name: string
  category: '应用' | '检索' | '原理' | '工程'
  difficulty: '入门' | '进阶' | '深入'
  explanation: string
  relatedIds: string[]
}

export interface LearningPath {
  id: string
  title: string
  description: string
  cardIds: string[]
  icon: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct: number
  explanation: string
  conceptIds: string[]
}

export const knowledgeCards: KnowledgeCard[] = [
  // ===== AGENT 模块 =====
  {
    id: 'agent-intro',
    title: 'Agent 本质：自主决策循环',
    module: 'agent',
    difficulty: '入门',
    summary: 'Agent 不是单一模型，而是由 LLM 大脑、工具调用、记忆系统、规划模块和交互接口组成的智能应用系统。',
    sections: [
      {
        title: 'Agent 的定义',
        content: 'Agent（智能体）是一个能自主感知环境、做出决策并执行动作的系统。它区别于普通聊天机器人的关键在于：Agent 能主动使用工具、制定计划、记住上下文，并根据反馈调整行为。',
        visualType: 'flow'
      },
      {
        title: '核心循环：Think → Act → Observe',
        content: 'Agent 的运行是一个持续的循环：\n1. Think（思考）：LLM 分析用户输入和当前状态\n2. Act（行动）：选择合适的工具并执行\n3. Observe（观察）：获取工具执行结果\n4. 判断是否完成任务，未完成则继续循环\n这个循环被称为 Agent Loop，是 Agent 区别于普通 LLM 应用的核心。',
        visualType: 'flow'
      },
      {
        title: 'Agent 系统架构',
        content: '完整的 Agent 包含五大组件：\n- LLM 大脑：负责推理与决策\n- 工具集：执行具体操作（搜索、计算、API 调用等）\n- 记忆系统：短期记忆（对话上下文）+ 长期记忆（向量存储）\n- 规划模块：将复杂任务分解为子任务\n- 交互接口：用户输入输出的通道',
        visualType: 'architecture'
      },
      {
        title: '最简 Agent 实现（30 行代码）',
        content: '一个最简单的 Agent 只需要三个要素：LLM 客户端、消息历史、运行循环。',
        codeExample: `class MinimalAgent:
    def __init__(self, system_prompt):
        self.messages = [{"role": "system", "content": system_prompt}]
    
    def run(self, user_input):
        self.messages.append({"role": "user", "content": user_input})
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=self.messages
        )
        reply = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": reply})
        return reply`,
        visualType: 'code'
      }
    ],
    keyTakeaways: [
      'Agent = LLM + Tools + Memory + Planning',
      'Agent Loop 是自主决策的核心机制',
      '从最简 30 行代码开始，逐步增加能力'
    ]
  },
  {
    id: 'agent-tools',
    title: '工具调用：给 Agent 装上手脚',
    module: 'agent',
    difficulty: '进阶',
    summary: '工具调用是 Agent 区别于普通聊天机器人最关键的能力。LLM 不直接执行工具，而是决定调用哪个工具、传什么参数；Agent 框架负责解析 LLM 的决策并实际执行。',
    sections: [
      {
        title: '工具调用的原理',
        content: 'LLM 本身不能搜索互联网或执行计算。工具调用机制让 LLM 输出一个"函数调用"标记，Agent 框架解析后进行实际调用，再将结果返回给 LLM。这是 Think → Act → Observe 循环的核心环节。',
        visualType: 'flow'
      },
      {
        title: 'Function Calling 格式',
        content: 'OpenAI 的 Function Calling 是当前主流的工具调用协议。每个工具需要定义：name（名称）、description（描述）、parameters（参数 schema）。LLM 读取这些定义后，决定是否调用工具以及传递什么参数。',
        visualType: 'code',
        codeExample: `tools = [{
    "type": "function",
    "function": {
        "name": "get_current_time",
        "description": "获取当前日期和时间",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
}]`
      },
      {
        title: '工具调用循环',
        content: 'Agent 需要处理多轮工具调用的场景：用户问一个复杂问题 → LLM 决定调用工具 A → 获取结果 → LLM 分析后决定再调用工具 B → 获取结果 → LLM 综合所有信息给出最终答案。每轮调用都包含：工具选择、参数提取、执行、结果注入四个步骤。',
        visualType: 'flow'
      }
    ],
    keyTakeaways: [
      'LLM 不执行工具，只决策用哪个、传什么参数',
      'Function Calling 是 LLM 与外部世界交互的标准协议',
      '多轮工具调用需要完善的错误处理和重试机制'
    ]
  },
  {
    id: 'agent-memory',
    title: '记忆系统：让 Agent 拥有"经验"',
    module: 'agent',
    difficulty: '进阶',
    summary: '记忆系统使 Agent 能跨对话保持上下文。它不仅是“把聊天记录存起来”，还包括存什么、存在哪里、何时写入、如何检索、如何压缩、如何遗忘和如何保护隐私。',
    sections: [
      {
        title: '为什么需要记忆系统',
        content: 'LLM 本身是无状态函数：输入一段 Prompt，输出一段文本。它不会天然记住“上一次你是谁、偏好是什么、刚刚执行过什么工具”。所谓 Agent 记忆系统，就是在 LLM 调用前后主动读写外部状态。\n\n它解决四类问题：\n1. 当前任务上下文：这一轮对话中已经说过什么、工具返回过什么\n2. 用户长期偏好：用户喜欢什么风格、常用参数、业务背景\n3. 任务执行历史：过去做过哪些尝试、哪些失败、哪些结论可复用\n4. 上下文窗口限制：当历史太长时，不能全部塞进 Prompt，必须筛选、摘要和检索',
        visualType: 'flow'
      },
      {
        title: '三层记忆架构',
        content: '工作记忆（Working Memory）：当前会话的消息列表、工具调用结果、临时变量。它最准确，但受上下文窗口限制，通常只保留最近 N 轮。\n\n短期记忆（Short-term Memory）：把较早的对话压缩成摘要，例如“用户正在做一个 RAG 客服项目，已经完成文档切分”。它牺牲细节，换取更低 token 成本。\n\n长期记忆（Long-term Memory）：跨会话持久保存的重要事实，例如用户偏好、项目背景、历史决策、常见问题。长期记忆一般不直接全量放进 Prompt，而是在需要时检索 Top-K 条。\n\n流转方式：工作记忆积累 → 超过阈值后摘要成短期记忆；发现稳定事实 → 写入长期记忆；新问题到来 → 从长期记忆检索相关内容 → 注入当前 Prompt。',
        visualType: 'architecture'
      },
      {
        title: '记忆到底存在哪里',
        content: '记忆不是只能存在“向量数据库”里。工程里通常会组合多种存储：\n\n1. 内存变量：保存当前请求生命周期内的临时状态，速度最快，但服务重启就丢失\n2. JSON / SQLite：适合本地 Demo、小工具、个人 Agent，简单可控\n3. 关系型数据库：如 PostgreSQL / MySQL，适合保存用户资料、会话记录、权限、任务状态等结构化数据\n4. Redis：适合短期缓存、会话状态、限流计数、最近对话窗口\n5. 对象存储：如本地文件、S3、OSS，适合保存长文档、附件、原始日志\n6. 向量数据库：如 Chroma、FAISS、Milvus、Pinecone，适合按语义相似度检索历史片段\n7. 图数据库：如 Neo4j，适合保存人、项目、组织、事件之间的关系网络\n\n一个成熟系统通常是“结构化数据库 + 向量库 + 缓存 + 原始日志”共同工作，而不是单一数据库解决一切。',
        visualType: 'comparison'
      },
      {
        title: '不同记忆适合的存储方式',
        content: '消息历史：适合存在关系型数据库或文档数据库，字段包括 user_id、session_id、role、content、created_at、tool_call_id。\n\n用户画像：适合存在关系型数据库，例如 name、language、preferred_style、timezone、常用业务参数。它需要准确更新，不适合只靠向量检索。\n\n语义事实：适合存向量数据库，例如“用户正在学习 Agent 记忆系统”“用户偏好中文详细解释”。查询时可以用“他之前学到哪里了？”语义召回。\n\n任务状态：适合存在 Redis 或数据库，例如当前执行到第几步、工具是否完成、失败原因。\n\n原始证据：适合保存到日志或对象存储，方便审计和回放。摘要和向量记忆可能丢细节，原始记录是最终证据源。',
        codeExample: `# 一条长期记忆通常不只保存文本，还要保存元数据
memory = {
    "user_id": "u_001",
    "type": "preference",
    "content": "用户喜欢用中文、希望解释尽量详细",
    "source": "conversation",
    "importance": 0.82,
    "created_at": "2026-07-02T10:30:00",
    "last_accessed_at": "2026-07-02T11:05:00",
    "tags": ["language", "learning_style"]
}

# content 转成 embedding 存向量库
# metadata 存数据库或向量库的 metadata 字段，用于过滤和排序`
      },
      {
        title: '写入记忆：不是所有内容都该存',
        content: '记忆写入需要“筛选器”，否则系统会把闲聊、重复内容、错误信息、隐私信息全部存进去，越记越乱。常见写入策略：\n\n显式写入：用户说“请记住我喜欢……”，直接保存。\n\n重要性打分：让 LLM 或规则判断信息是否长期有用，例如用户偏好、身份信息、项目背景、稳定事实。\n\n去重合并：如果已有“用户喜欢简洁回答”，又出现“用户希望回答短一点”，应该更新同一条偏好，而不是新增重复记忆。\n\n冲突处理：如果新信息与旧信息冲突，例如用户从“喜欢简洁”变成“希望详细”，要记录更新时间，优先使用最新可信记忆。\n\n隐私过滤：密码、身份证、密钥、银行卡、私密健康信息默认不应写入长期记忆，除非业务有明确授权和安全设计。',
        visualType: 'flow'
      },
      {
        title: '检索记忆：如何从海量历史里找出相关内容',
        content: '用户提出新问题时，Agent 不应该把所有历史都塞进 Prompt，而是先检索。典型流程：\n\n1. 查询改写：把用户当前问题改写成适合检索的 query，例如“继续上次项目” → “用户上次正在做的项目、进度、待办事项”\n2. 候选召回：从向量库检索语义相近的 Top-K 记忆，也可以用 BM25 检索关键词\n3. 元数据过滤：只取当前 user_id、当前项目、未过期、权限允许的记忆\n4. 重排序：按相关性、重要性、时间新鲜度、可信度综合排序\n5. Prompt 注入：只把最有帮助的 3~8 条放入上下文，并明确标注为“可参考记忆”，避免污染事实判断',
        codeExample: `def retrieve_memories(user_id: str, question: str):
    query = rewrite_for_memory_search(question)
    candidates = vector_db.search(
        query=query,
        top_k=20,
        filter={"user_id": user_id}
    )
    ranked = sorted(
        candidates,
        key=lambda m: 0.6 * m.similarity + 0.3 * m.importance + 0.1 * m.recency,
        reverse=True
    )
    return ranked[:5]`
      },
      {
        title: '记忆压缩、遗忘与更新',
        content: '记忆系统不能只增不减。长期运行后，历史会越来越多，必须有维护机制：\n\n压缩：把多轮对话压缩为结构化摘要，例如“目标、已完成、未完成、关键决策、风险”。\n\n遗忘：低重要性、长期未访问、过期的记忆可以删除或归档。比如“今天下午 3 点开会”过期后价值很低。\n\n强化：被频繁检索并确实有用的记忆，可以提高 importance。\n\n更新：用户偏好、项目状态会变化，需要覆盖旧值或保留版本历史。\n\n审计：关键记忆应能追溯来源，知道它来自哪次对话、哪份文档、哪个工具返回。否则 Agent 可能把错误记忆当成事实。',
        visualType: 'comparison'
      },
      {
        title: '向量数据库实现长期语义记忆',
        content: '向量数据库适合解决“我不知道该用什么关键词，但想找语义相关历史”的问题。写入时，把记忆文本转成 embedding 向量并保存；查询时，把用户问题也转成向量，用余弦相似度或内积找最近的记忆。\n\n注意：向量库不是事实数据库。它擅长“找相关内容”，不擅长保证唯一、最新、权限正确。所以工程上通常要配合 metadata 过滤、时间排序、重要性分数和关系型数据库。',
        codeExample: `# 存储记忆
vector_memory.store(
    text="用户张三喜欢喝咖啡",
    metadata={"user_id": "zhangsan", "type": "preference", "importance": 0.9}
)

# 语义检索
relevant = vector_memory.retrieve(
    query="张三喜欢什么饮品",
    filter={"user_id": "zhangsan"},
    top_k=3
)

# 结果: ["用户张三喜欢喝咖啡"]`
      }
    ],
    keyTakeaways: [
      'LLM 无状态，Agent 记忆本质上是外部状态管理',
      '三层记忆：工作记忆保存当前上下文，短期记忆做摘要，长期记忆跨会话持久化',
      '不同记忆适合不同存储：数据库存结构化事实，Redis 存短期状态，向量库存语义片段，日志存原始证据',
      '记忆系统必须设计写入、检索、压缩、遗忘、更新和隐私过滤机制',
      '向量数据库只负责语义召回，不等于完整的事实数据库'
    ]
  },
  {
    id: 'agent-knowledgemap',
    title: 'Agent 开发者完整技能树',
    module: 'agent',
    difficulty: '深入',
    summary: '从事 Agent 开发需要完整的技术栈：Python 编程、LLM 原理、Agent 架构设计、RAG 技术、生产部署和评估监控六大板块。',
    sections: [
      {
        title: '基础层：Python 与工程基础',
        content: '异步编程（asyncio）：处理并发工具调用。\nAPI 与网络通信：RESTful API、WebSocket、gRPC。\n数据结构：理解消息队列、对话状态树、工具依赖图。\n错误处理：重试机制（tenacity）、超时控制、降级策略。',
        visualType: 'comparison'
      },
      {
        title: '核心层：LLM 与 Agent 架构',
        content: 'LLM 原理：Transformer、Tokenization、上下文窗口。\nPrompt Engineering：结构化模板、Few-shot、CoT、ReAct。\nAgent 架构模式：ReAct（推理+行动）、Plan-Execute（先规划后执行）、Reflexion（自我反思）。\n记忆系统设计：三层架构、向量存储、知识图谱。\n多 Agent 协作：角色分配、通信协议、任务分发与结果聚合。',
        visualType: 'architecture'
      },
      {
        title: '进阶层：生产化与评估',
        content: '框架选择：LangChain/LangGraph、AutoGen、CrewAI。\n服务部署：FastAPI、流式输出（SSE）、负载均衡。\n可观测性：LangSmith、LangFuse、成本追踪、调用链追踪。\n安全护栏：输入验证、越狱检测、敏感词过滤、权限控制。\n效果评估：任务完成率、工具使用准确率、用户满意度。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      'Agent 开发不只是写 Prompt，需要完整的工程能力',
      '推荐学习路径：基础→核心→增强→拓展→工程',
      '先用 ReAct 模式跑通最小 Agent，再逐步添加能力'
    ]
  },

  // ===== RAG 模块 =====
  {
    id: 'rag-intro',
    title: 'RAG：给 LLM 装上外挂知识库',
    module: 'rag',
    difficulty: '入门',
    summary: 'RAG（Retrieval-Augmented Generation）是让 LLM 能使用外部知识回答问题的技术。核心流程：文档加载 → 文档切分 → 向量化 → 检索 → 上下文注入 → 生成回答。',
    sections: [
      {
        title: 'RAG 解决的问题',
        content: '传统 LLM 有三个限制：\n1. 知识截止日期固定，不知道最新信息\n2. 无法访问私有文档（公司内部资料）\n3. 容易"幻觉"（编造不存在的信息）\n\nRAG 的解决方式：先把相关知识从外部文档中检索出来，再让 LLM 基于这些真实文档回答，而不是凭空生成。',
        visualType: 'comparison'
      },
      {
        title: 'RAG 五步流程',
        content: '步骤 1：文档加载（Load）- 读取 PDF、TXT、Markdown 等\n步骤 2：文档分割（Split）- 切分为 500 字左右的块\n步骤 3：向量化存储（Embed & Store）- 转为向量存入数据库\n步骤 4：检索（Retrieve）- 根据用户问题找到最相关的文档块\n步骤 5：生成（Generate）- 将相关文档注入 Prompt，让 LLM 回答',
        visualType: 'flow'
      },
      {
        title: '最简单的 RAG 实现',
        content: '核心代码只有 4 步：检索 → 拼接上下文 → 构建 Prompt → 调用 LLM。关键是让 LLM 只基于检索到的文档回答，而非靠自己记忆。',
        codeExample: `class SimpleRAG:
    def ask(self, question, k=3):
        docs = self.vectorstore.similarity_search(question, k=k)
        context = "\\n".join([d.page_content for d in docs])
        prompt = f"基于以下信息回答：\\n{context}\\n\\n问题：{question}"
        return llm.chat(prompt)`
      }
    ],
    keyTakeaways: [
      'RAG = 检索 + 生成，先找资料再回答',
      '知识库不需要写成 Key-Value 格式',
      '保持文档的自然语言格式效果最好'
    ]
  },
  {
    id: 'rag-advanced',
    title: 'RAG 高级技术：多路召回与重排序',
    module: 'rag',
    difficulty: '进阶',
    summary: '基础 RAG 只做向量检索，高级 RAG 结合关键词检索（BM25）、查询改写和多路召回融合，再加上重排序（Reranker）来提升检索精度。',
    sections: [
      {
        title: '为什么需要多路召回',
        content: '向量检索擅长语义匹配，但有时会漏掉精确关键词。比如搜索"退款政策"，向量检索可能返回"退货流程"（语义相近），但用户可能更想要精确包含"退款政策"四个字的文档。多路召回结合：\n- 语义检索（向量相似度）：理解意思\n- 关键词检索（BM25）：精确匹配\n- FAQ 匹配：对高频问题直接映射',
        visualType: 'comparison'
      },
      {
        title: '重排序（Reranking）',
        content: '检索阶段为了速度，使用轻量级的向量相似度计算。重排序阶段用更强的模型（交叉编码器 Cross-Encoder）对候选文档重新打分，大幅提升精度。\n\n流程：粗排（Top-50）→ 重排序（Top-10）→ 精选（Top-3）。重排序虽然慢，但只对少量候选运行，代价可接受。',
        visualType: 'flow'
      },
      {
        title: '查询优化技术',
        content: '查询改写：把模糊的用户问题改写为更精确的检索查询。\n查询扩展（Query Expansion）：自动添加同义词和相关词。\nHyDE（假设文档嵌入）：先让 LLM 生成一个假设答案，用这个答案去检索，比直接用问题检索更准确。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      '多路召回 = 语义检索 + 关键词检索 + FAQ 匹配',
      '重排序用更强的模型重新打分，提升精度',
      '查询改写和 HyDE 能显著改善检索效果'
    ]
  },
  {
    id: 'rag-chunk',
    title: '文档切分：Chunk 设计的艺术',
    module: 'rag',
    difficulty: '进阶',
    summary: '文档切分（Chunking）是 RAG 最关键的前置步骤。chunk_size（每块大小）和 chunk_overlap（块间重叠）的选择直接影响检索精度和回答质量。',
    sections: [
      {
        title: 'RecursiveCharacterTextSplitter 原理',
        content: '递归字符分割器按优先级从高到低尝试分隔符：\n\n\\n\\n（段落）→ \\n（行）→ 。（句号）→ ！（感叹号）→ ？（问号）→ ，（逗号）→ 空格 → 逐字符\n\n这样设计的好处是优先在自然的语义边界处分割，避免把一句话从中间切断。',
        visualType: 'flow'
      },
      {
        title: 'chunk_size 选择指南',
        content: 'chunk_size 太小（< 200）：信息碎片化，一个完整的概念被拆散\nchunk_size 适中（300-500）：检索精度高，信息相对完整\nchunk_size 较大（800-1000）：单块信息丰富但可能混入不相关内容\n\n经验法则：\n- FAQ 类：200-300（每个问答对独立）\n- 政策文档：500-800（保持段落完整）\n- 代码文档：800-1000（保持函数完整）',
        visualType: 'comparison'
      },
      {
        title: 'chunk_overlap 的作用',
        content: '块间重叠是为了防止关键信息恰好落在两个块的边界处。\n\n没有重叠：块 A 末尾是"申请年假需要"... 块 B 开头是"...提前一周提交"，LLM 看到块 A 不知道具体怎么操作。\n\n有重叠（50 字符）：块 A 末尾是"申请年假需要提前一周提交 OA"，信息完整。\n\n通常 overlap 设为 chunk_size 的 10-20%。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      '按自然语义边界分割（段落 > 句子 > 词组）',
      'FAQ 用小 chunk，政策文档用大 chunk',
      'chunk_overlap 防止信息在边界处断裂'
    ]
  },
  {
    id: 'rag-customer-service',
    title: '实战：智能客服 RAG 系统',
    module: 'rag',
    difficulty: '深入',
    summary: '智能客服是 RAG 最经典的应用。完整方案包括：知识库构建、多路召回检索、意图识别、置信度检查、升级人工机制和对话管理。',
    sections: [
      {
        title: '知识库结构与 FAQ 设计',
        content: '智能客服知识库需要特别优化：\n- 每个 FAQ 包含：标准问题 + 答案 + 关键词 + 适用场景 + 关联问题\n- 按类别组织：退款 / 订单 / 物流 / 账户 / 投诉\n- 为 FAQ 文档添加关键词字段（"退款、退钱、退货"），支持关键词精确匹配\n- 话术文档需要标准模板，确保回答一致性',
        visualType: 'architecture'
      },
      {
        title: '多路召回与置信度',
        content: '智能客服使用三路召回：\n1. 关键词精确匹配（优先级最高，直接命中 FAQ 关键词）\n2. 语义向量检索（覆盖面广，处理变体问题）\n3. FAQ 问题相似度匹配（用 TF-IDF 计算用户问题与 FAQ 问题的相似度）\n\n置信度阈值：低于 0.6 的回答建议转人工，避免给出错误答案。',
        visualType: 'flow'
      },
      {
        title: '敏感问题检测与升级',
        content: '必须设置升级机制：\n- 敏感词检测：投诉、起诉、315、曝光、律师函 → 立即转人工\n- 情绪检测：用户表达愤怒/不满 + 紧急问题 → 升级处理\n- 置信度不足：检索结果相关度低 → 主动建议转人工\n- 多轮未解决：同一问题轮次过多 → 升级',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      'FAQ 文档需要特别优化（关键词 + 关联问题）',
      '三路召回：关键词精确 + 语义向量 + FAQ 匹配',
      '升级机制是智能客服的兜底保障'
    ]
  },

  // ===== EMBEDDING 模块 =====
  {
    id: 'embedding-intro',
    title: 'Embedding：让机器"理解"语义',
    module: 'embedding',
    difficulty: '入门',
    summary: 'Embedding（向量化）是把文字转成数字向量的技术。语义相似的文本，向量距离近；语义无关的文本，向量距离远。这是 RAG 检索和语义搜索的基础。',
    sections: [
      {
        title: '向量化的本质',
        content: '"我喜欢机器学习" → Embedding → [0.23, -0.45, 0.78, ..., 0.12]（1536 维向量）\n\n这是把人类语言翻译成机器能计算的数字格式。向量的每个维度代表一种语义特征（虽然没有明确标签），所有维度共同构成文本在"语义空间"中的位置。',
        visualType: 'flow'
      },
      {
        title: '语义相似度计算',
        content: '最常用的相似度是余弦相似度（Cosine Similarity）：\n\n公式：cos(θ) = (A·B) / (||A|| × ||B||)\n\n值域 [-1, 1]，1 表示完全相同方向，0 表示正交（无关），-1 表示完全相反。\n\n举例：\n"猫" vs "狗" → 0.89（都是宠物，语义接近）\n"猫" vs "汽车" → 0.12（不相关）\n"退款" vs "退货" → 0.91（都是售后操作）',
        visualType: 'comparison'
      },
      {
        title: '向量空间的有趣特性',
        content: '向量空间支持语义运算：\n国王 - 男人 + 女人 ≈ 王后\n巴黎 - 法国 + 意大利 ≈ 罗马\n\n这说明向量确实编码了语义关系。"减法"去掉了"性别"特征，"加法"加上新的性别特征，结果自然地指向了"王后"。',
        visualType: 'flow'
      }
    ],
    keyTakeaways: [
      'Embedding = 文字转数字，让机器能计算语义',
      '余弦相似度衡量两个向量方向的接近程度',
      '向量空间支持语义运算（类比推理）'
    ]
  },
  {
    id: 'embedding-deep',
    title: 'Embedding 深入：模型原理与优化',
    module: 'embedding',
    difficulty: '进阶',
    summary: '深入理解嵌入模型的内部机制、不同模型对比，以及如何预处理文本和缓存向量来优化 RAG 系统性能。',
    sections: [
      {
        title: '嵌入模型内部机制',
        content: '嵌入模型的处理流程：\n1. Token 化：分词（"猫吃鱼" → [234, 567, 890]）\n2. 嵌入表查询：每个 token 获取初始向量\n3. Transformer 处理：考虑上下文，调整每个 token 的向量\n4. 池化：取所有 token 向量的平均作为整个句子的向量\n\n经过多层 Transformer 处理后，向量不再是孤立词义的简单叠加，而是融合了整句的语义。',
        visualType: 'architecture'
      },
      {
        title: '主流模型选择',
        content: 'OpenAI text-embedding-ada-002：1536 维，效果最好，收费\nHuggingFace all-MiniLM-L6-v2：384 维，免费本地运行\nCohere embed-v3：1024 维，多语言支持好\n\n选择建议：\n- 生产环境 → OpenAI（质量最优）\n- 快速原型 → HuggingFace（免费、本地）\n- 多语言 → Cohere（中文效果不错）',
        visualType: 'comparison'
      },
      {
        title: '性能优化技巧',
        content: '缓存机制：对相同文本不要重复调用 API，用文本 hash 做 key 缓存结果。\n文本预处理：去除无意义的空格和特殊字符能提升向量质量。\n动态加权：对标题赋予更高权重，让标题的关键词对检索影响更大。\n批量处理：embed_documents 比逐个 embed_query 效率高得多。',
        visualType: 'code',
        codeExample: `# 缓存优化
cache = {}
def embed_with_cache(text):
    h = hash(text)
    if h not in cache:
        cache[h] = embeddings.embed_query(text)
    return cache[h]`
      }
    ],
    keyTakeaways: [
      '嵌入模型内部经过 Token → Embed → Transformer → Pool 四步',
      '生产用 OpenAI，原型用 HuggingFace',
      '缓存 + 批量 + 预处理是性能优化的三件套'
    ]
  },

  // ===== TRANSFORMER 模块 =====
  {
    id: 'transformer-intro',
    title: 'Transformer：现代 AI 的基石',
    module: 'transformer',
    difficulty: '入门',
    summary: 'Transformer 是 2017 年提出的革命性架构，完全基于注意力机制，摒弃了传统的循环神经网络。GPT、BERT、所有现代大模型都基于 Transformer。',
    sections: [
      {
        title: 'Transformer 的核心创新',
        content: '传统 RNN：输入 1 → 输入 2 → 输入 3（必须串行，无法并行）\nTransformer：所有输入同时处理（并行计算）\n\nTransformer 抛弃了 RNN 的循环结构，用自注意力机制让每个词同时关注所有其他词。这带来了两大优势：\n1. 可以并行训练（大幅提速）\n2. 能捕捉长距离依赖（"它"能关注到 50 个词之前的"猫"）',
        visualType: 'comparison'
      },
      {
        title: '整体架构',
        content: '输入文本 → 嵌入+位置编码 → 编码器（多层）→ 解码器（多层）→ 线性+Softmax → 输出\n\n编码器：理解输入的含义（双向注意力，能看到整个句子）\n解码器：逐个生成输出（单向注意力，只能看到已生成的词）\n\nGPT 只用解码器，BERT 只用编码器，T5 两者都用。',
        visualType: 'architecture'
      },
      {
        title: '三大变体',
        content: '纯编码器（BERT）：适合理解任务（分类、情感分析、搜索）\n纯解码器（GPT）：适合生成任务（对话、写作、代码生成）\n编码器-解码器（T5）：适合转换任务（翻译、摘要、问答）\n\n你用的聊天 LLM 都是纯解码器架构（GPT 系列）。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      'Transformer = 自注意力 + 并行处理',
      '编码器理解输入，解码器生成输出',
      'GPT 只用解码器，BERT 只用编码器'
    ]
  },
  {
    id: 'attention-mechanism',
    title: '自注意力：Transformer 的灵魂',
    module: 'transformer',
    difficulty: '深入',
    summary: '自注意力（Self-Attention）是 Transformer 最核心的机制。它让每个词能动态地"关注"句子中的其他词，理解上下文中的语义关联。',
    sections: [
      {
        title: '直觉理解',
        content: '句子："猫吃了鱼，因为它饿了"\n问题："它"指什么？\n\n自注意力让模型计算"它"与每个词的相关度：\n"它" → "猫"：权重 0.8（最高，指代关系）\n"它" → "鱼"：权重 0.1\n"它" → "吃"：权重 0.1\n\n通过注意力权重，模型"知道""它"指的是"猫"。',
        visualType: 'flow'
      },
      {
        title: 'Q、K、V 三兄弟',
        content: '每个词会生成三个向量：\n\nQ（Query，查询）："我在找什么？" —— 当前词想要关注什么\nK（Key，键）："我有什么？" —— 用来被其他词匹配\nV（Value，值）："我提供什么信息？" —— 被关注后实际贡献的内容\n\n注意力计算的本质：用 Q 去匹配所有词的 K，得到匹配分数（相关度），用这些分数对 V 加权求和，得到最终输出。',
        visualType: 'comparison'
      },
      {
        title: '注意力公式详解',
        content: '公式：Attention(Q,K,V) = softmax(QKᵀ / √dₖ) × V\n\n分解理解：\n1. QKᵀ：计算每对词之间的相关度得分（矩阵乘法）\n2. ÷ √dₖ：缩放，防止点积过大导致 softmax 梯度消失\n3. softmax：把分数归一化为权重（所有权重之和为 1）\n4. × V：用权重对 Value 加权求和\n\n这个公式虽然简洁，但蕴含了 Transformer 全部的核心思想。',
        visualType: 'flow'
      },
      {
        title: '多头注意力',
        content: '单头注意力只能从一个角度理解词间关系。多头注意力（Multi-Head）把 Q、K、V 分成多个子空间，每个"头"关注不同的方面：\n\n头 1：关注语法关系（主谓宾）\n头 2：关注指代关系（代词指向）\n头 3：关注语义关联（同义/反义）\n...\n\n最后把所有头的结果拼接起来，再做一次线性变换。GPT-3 有 96 个注意力头。',
        visualType: 'architecture'
      }
    ],
    keyTakeaways: [
      'Q 查询、K 匹配、V 提供信息',
      'Attention = softmax(QKᵀ/√dₖ) × V',
      '多头注意力让模型从多个角度理解关系'
    ]
  },
  {
    id: 'positional-encoding',
    title: '位置编码与 Transformer 细节',
    module: 'transformer',
    difficulty: '深入',
    summary: '自注意力本身不关心词的顺序，位置编码为每个词注入位置信息。前馈网络（FFN）、残差连接和层归一化是 Transformer 稳定训练的关键组件。',
    sections: [
      {
        title: '为什么需要位置编码',
        content: '自注意力计算的是词与词之间的关系，与顺序无关。"猫吃鱼"和"鱼吃猫"在自注意力看来可能一样！\n\n位置编码给每个位置的词打上"位置标签"：\n- 正弦/余弦编码：用三角函数生成位置向量，不需要训练\n- 可学习编码：把位置也当作可训练的参数\n\n在输入向量上直接加上位置编码，模型就知道哪个词在前面、哪个在后面。',
        visualType: 'flow'
      },
      {
        title: '前馈神经网络（FFN）',
        content: '每个 Transformer 层中，自注意力后面都跟着一个前馈网络。\n\nFFN 的作用：对每个位置独立地进行非线性变换，增加模型的表达能力。\n\n结构：Linear → ReLU → Linear\n第一个线性层把维度放大（通常是 4 倍），ReLU 引入非线性，第二个线性层还原维度。\n\n注意力和 FFN 的组合让模型既理解词间关系（注意力），又能对每个词的表示进行深度加工（FFN）。',
        visualType: 'architecture'
      },
      {
        title: '残差连接与层归一化',
        content: '残差连接：x + F(x)，把输入直接加到输出上\n作用：让梯度能"跳过"复杂计算直接回传，解决深层网络的训练困难\n\n层归一化：对每个样本的特征维度做归一化\n作用：稳定训练过程，加速收敛\n\n在 Transformer 中，每个子层（注意力、FFN）后面都是：\n输出 = LayerNorm(输入 + Dropout(子层输出))',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      '位置编码让模型知道词的先后顺序',
      'FFN = 把维度放大 4 倍 → 激活 → 还原',
      '残差+归一化 = 深层网络稳定训练的关键'
    ]
  },

  // ===== ENGINEERING 模块 =====
  {
    id: 'engineering-async',
    title: 'Agent 异步编程与并发',
    module: 'engineering',
    difficulty: '进阶',
    summary: 'Agent 需要同时调用多个工具、处理并发请求、等待外部 API 响应而不阻塞主流程。Python asyncio 和 aiohttp 是 Agent 高性能运行的基础。',
    sections: [
      {
        title: '为什么 Agent 需要异步',
        content: 'Agent 的一个典型场景：用户问"帮我查北京和上海的天气，然后对比"——这需要同时调用两次天气 API。\n\n同步方式：查北京（等 2 秒）→ 查上海（等 2 秒）→ 对比 → 返回（总共 4 秒+）\n异步方式：同时查北京和上海（并行等 2 秒）→ 对比 → 返回（总共 2 秒+）\n\n在高并发客服场景中，异步可以让单个进程同时处理数十个用户请求，而非串行等待。',
        visualType: 'comparison'
      },
      {
        title: 'asyncio 核心概念',
        content: 'async def：定义协程函数，调用时返回协程对象（不立即执行）。\nawait：挂起当前协程，等待被调用的协程完成，期间可切换到其他协程。\nasyncio.gather()：并发执行多个协程，等全部完成后返回结果列表。\nasyncio.create_task()：创建后台任务，不阻塞当前协程。\n\nevent loop（事件循环）：调度所有协程的核心引擎，决定哪个协程在什么时候执行。',
        visualType: 'code',
        codeExample: `import asyncio
import aiohttp

async def call_tool(url: str) -> dict:
    """异步调用一个工具 API"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            return await resp.json()

async def agent_run(query: str):
    # 同时调用多个工具
    results = await asyncio.gather(
        call_tool("http://api/weather/beijing"),
        call_tool("http://api/weather/shanghai"),
        call_tool("http://api/news/today"),
    )
    # 三个请求并行，总耗时 ≈ max(单个耗时)
    return results`
      },
      {
        title: 'Agent 中的常见异步模式',
        content: '1. 工具并发调用：多个独立工具同时调用（如天气+新闻+股价）→ asyncio.gather\n2. 流式输出：边生成边发送给前端 → async generator + SSE\n3. 超时控制：工具调用设置最大等待时间 → asyncio.wait_for(task, timeout=10)\n4. 重试机制：工具失败后自动重试 → tenacity 库 + async retry\n5. 信号量限流：控制并发工具调用数量 → asyncio.Semaphore(max_concurrent)',
        visualType: 'flow'
      }
    ],
    keyTakeaways: [
      '异步让多个工具并发调用，而非串行等待',
      'asyncio.gather() 是代理并发工具调用的核心',
      '流式输出 + 超时控制 + 重试是生产 Agent 的标配'
    ]
  },
  {
    id: 'engineering-deploy',
    title: '生产部署：FastAPI + 流式输出',
    module: 'engineering',
    difficulty: '深入',
    summary: '将 Agent 从本地脚本变成线上服务需要：FastAPI Web 框架、流式输出（SSE/WebSocket）、负载均衡和容错机制。这是 Agent 从"能用"到"好用"的关键一步。',
    sections: [
      {
        title: 'FastAPI 服务封装',
        content: 'FastAPI 是目前 Python 最流行的异步 Web 框架，天然支持 asyncio，与 Agent 的异步工具调用完美契合。\n\n核心组件：\n- @app.post("/chat")：REST API 端点\n- BackgroundTasks：后台任务（如日志写入）\n- Dependency Injection：复用 Agent 实例\n- Pydantic Model：请求/响应的类型校验\n\n优势：自动生成 OpenAPI 文档、类型安全、高性能。',
        visualType: 'code',
        codeExample: `from fastapi import FastAPI
from pydantic import BaseModel

class ChatRequest(BaseModel):
    user_id: str
    message: str

class ChatResponse(BaseModel):
    answer: str
    confidence: float
    sources: list[str]

app = FastAPI()
agent = CustomerServiceAgent()  # 全局单例

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    result = await agent.run_async(req.message)
    return ChatResponse(**result)`
      },
      {
        title: '流式输出：SSE vs WebSocket',
        content: 'SSE（Server-Sent Events）：\n- 单向（服务器 → 客户端）\n- 基于 HTTP，自动重连\n- 适合 LLM 逐 token 推送\n- 实现简单，兼容性好\n\nWebSocket：\n- 双向通信\n- 独立的 WS 协议\n- 适合需要客户端频繁交互的场景\n- 实现复杂，需要心跳保活\n\nAgent 回答推荐使用 SSE：边生成边显示，用户体验大幅提升。',
        visualType: 'comparison',
        codeExample: `# SSE 流式输出
from fastapi.responses import StreamingResponse

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    async def generate():
        async for token in agent.stream(req.message):
            yield f"data: {token}\\n\\n"
        yield "data: [DONE]\\n\\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )`
      },
      {
        title: '生产化检查清单',
        content: '部署前必须确认：\n\n1. 错误处理：LLM 调用超时/失败 → 降级回答或转人工\n2. 速率限制：每个用户/IP 的频率控制 → slowapi 或 Redis 令牌桶\n3. 日志记录：每次对话的完整链路 → structlog + ELK\n4. 健康检查：/health 端点供负载均衡器探测\n5. 配置管理：.env → pydantic-settings\n6. 容器化：Dockerfile + docker-compose\n7. 负载均衡：Nginx 反向代理 → 多 worker 进程',
        visualType: 'flow'
      }
    ],
    keyTakeaways: [
      'FastAPI + asyncio 是 Agent 服务化的最佳组合',
      'SSE 流式输出让回答"边想边说"，体验远超一次性返回',
      '生产化 = 错误处理 + 限流 + 日志 + 健康检查 + 容器化'
    ]
  },
  {
    id: 'engineering-monitoring',
    title: '可观测性：LangSmith / LangFuse',
    module: 'engineering',
    difficulty: '进阶',
    summary: 'Agent 在生产环境中是一个"黑盒"——你需要知道它每一步在想什么、调了什么工具、花了多少 token、哪里出了错。可观测性（Observability）就是给 Agent 装上"行车记录仪"。',
    sections: [
      {
        title: '为什么需要可观测性',
        content: 'Agent 不同于传统 API——它的行为是"涌现"的：\n- 用户问了什么 → 意图识别对不对？\n- Agent 选择了哪个工具 → 选择合理吗？\n- 工具返回了什么 → 结果有没有被正确理解？\n- 最终回答基于哪些文档 → 有没有幻觉？\n- 花了多少 token/时间/钱 → 成本是否可控？\n\n没有可观测性，你只能看到"用户问了 → Agent 答了"，中间过程完全不可见。出问题时无从排查。',
        visualType: 'flow'
      },
      {
        title: 'LangSmith 核心能力',
        content: 'LangSmith（LangChain 官方）提供：\n\n1. 链路追踪（Tracing）：记录每次 LLM 调用、工具调用、检索步骤的完整调用链\n2. 数据集管理：创建测试用例集，批量评估 Agent 表现\n3. 实验对比：修改 Prompt 后同时跑新旧版本，对比效果\n4. 反馈收集：用户点赞/点踩 → 关联到具体调用 → 发现薄弱点\n5. 成本监控：按模型/项目/用户统计 token 消耗\n\n集成只需 3 行代码！',
        visualType: 'comparison',
        codeExample: `# LangSmith 集成（仅需设置环境变量）
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls_..."
os.environ["LANGCHAIN_PROJECT"] = "customer-service-agent"

# 之后所有 LangChain/LangGraph 调用都会被自动追踪
# 在 LangSmith UI 中查看完整调用链和性能指标`
      },
      {
        title: '自建监控 vs 使用平台',
        content: '方案一：LangSmith / LangFuse（推荐）\n- 开箱即用，无需自建基础设施\n- LangFuse 开源可自托管（数据不出企业）\n- 自动聚合 LLM 调用、工具调用、检索步骤\n\n方案二：自建监控（灵活但工作量大）\n- 使用 structlog 记录结构化日志 → ELK / Grafana\n- 自定义 decorator 统计函数耗时\n- 需要自己设计存储和分析方案\n\n建议：先用 LangFuse（开源免费）快速搭建，后期按需迁移。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      'Agent 可观测性 = 链路追踪 + 成本监控 + 效果评估',
      'LangSmith/LangFuse 只需几行代码集成，大幅降低排错成本',
      '没有监控的 Agent 是盲飞的，出了问题无从查起'
    ]
  },

  // ===== EMBEDDING 深入补充 =====
  {
    id: 'embedding-semantic-theory',
    title: '词向量为什么能表示语义',
    module: 'embedding',
    difficulty: '进阶',
    summary: '"猫"和"狗"的向量相似度 0.89，"猫"和"汽车"只有 0.12——为什么？这背后是分布假说（Distributional Hypothesis）：词的含义由其上下文语境决定。',
    sections: [
      {
        title: '分布假说（Distributional Hypothesis）',
        content: '语言学核心假说："You shall know a word by the company it keeps"（观其伴，知其义）——J.R. Firth, 1957\n\n意思是：一个词的含义，由它经常和哪些词一起出现决定。\n\n"猫"和"狗"在训练语料中共享大量相似的上下文：\n- "宠物{猫/狗}"、"可爱的{猫/狗}"、"饲养{猫/狗}"\n- "猫咪/狗狗"、"遛猫/遛狗"、"猫粮/狗粮"\n\n"猫"和"汽车"的共现上下文很少：\n- "猫在{车顶/引擎盖}上睡觉"（罕见的偶然共现）\n\n大量文本中统计出的共现模式，让模型学到："猫"和"狗"的语义环境相似 → 向量距离近。',
        visualType: 'flow'
      },
      {
        title: '词向量的训练过程（以 Word2Vec 为例）',
        content: 'Word2Vec 的核心任务不是分类或生成，而是"预测上下文"：\n\nSkip-gram 模式：给定中心词，预测周围的词。\n- 输入："猫"\n- 目标：预测 ["宠物", "可爱", "饲养", ...]（这些是"猫"周围常出现的词）\n\n训练过程中，模型被迫把语义相近的词映射到相近的向量空间区域——因为它们的"预测目标"（上下文词）高度重叠。\n\n这就像一个"人以群分"的过程：经常出现在同一群人中的两个人，自然被认为是相似的人。',
        visualType: 'architecture'
      },
      {
        title: '对比学习：现代 Embedding 模型的训练方式',
        content: '现代 Embedding 模型（如 text-embedding-3）使用对比学习（Contrastive Learning）：\n\n正样本对：语义相同/相似的文本（如 QA 对、同义句）→ 拉近向量距离\n负样本对：语义无关的文本（随机配对）→ 推远向量距离\n\n训练目标：让正样本对的余弦相似度尽可能大，负样本对尽可能小。\n\n这比 Word2Vec 更直接——不是"预测上下文"，而是直接优化"相似文本向量近、无关文本向量远"这个目标。\n\n结果就是你在 Embedding 实验室中看到的：\n"退款" vs "退货" → 0.91（正样本层面的语义相关）\n"猫" vs "汽车" → 0.15（负样本层面的语义无关）',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      '分布假说：词的含义 = 它周围词的统计分布',
      'Word2Vec 通过预测上下文迫使近义词向量靠近',
      '现代 Embedding 直接用对比学习优化"相似拉近、无关推远"'
    ]
  },
  {
    id: 'embedding-pretrained-model',
    title: '预训练语义模型揭秘',
    module: 'embedding',
    difficulty: '深入',
    summary: '调用 OpenAIEmbeddings() 等于加载一个冻结的预训练模型。它用大量数据训练好后不再改变——这就是 Embedding 在 RAG 中的设计哲学：冻结的语义理解 + 可更新的外部知识。',
    sections: [
      {
        title: 'Embedding 模型 = 冻结的语义空间',
        content: '当你调用 embeddings.embed_query("机器学习") 时，发生的事：\n\n1. 分词："机器学习" → [token_id_1234, token_id_5678]\n2. 查嵌入表：每个 token 获取初始向量\n3. Transformer 处理：多层注意力考虑上下文，调整向量\n4. 池化（Pooling）：对所有 token 向量取平均 → 一个 1536 维的向量\n\n这个模型是"冻结"的——训练完成后参数不再改变。\n\n这意味着：模型的知识截止于其训练数据的时间点（如 OpenAI 的截止于 2021 年），它不知道 2024 年发生的事，也不知道你公司的内部文档。',
        visualType: 'architecture'
      },
      {
        title: '为什么 RAG 用冻结模型而不微调',
        content: 'RAG 的设计哲学：分离"语义理解"和"知识存储"。\n\n冻结 Embedding 模型 → 负责语义理解（"这句话是什么意思"）\n可更新向量数据库 → 负责知识存储（"这句话涉及的实时信息"）\n\n这样分工的好处：\n- 新知识只需存入向量数据库，无需重新训练模型\n- 模型本身保持稳定，不会因为学习新知识而"遗忘"旧能力\n- 成本极低（向量检索 vs GPU 微调）\n\n如果微调 Embedding 模型来适应新领域知识，确实能提升特定领域检索精度，但成本和复杂度大幅增加。对大多数应用来说，"冻结模型 + 更新知识库"是最佳性价比方案。',
        visualType: 'comparison'
      },
      {
        title: '新文档中出现未知词汇会怎样',
        content: '这是 RAG 的常见问题：如果你的知识库包含模型训练数据中没有的词汇（新产品名、专业术语），会发生什么？\n\n子词分词（BPE）是解决方案：\n- 分词器把生词拆成已知的子词单元\n- 例如 "QLoRA"（模型没学过）→ ["Q", "Lo", "RA"]（三个子词）\n- 每个子词都有已知的嵌入向量，组合后仍能产生有意义的语义表示\n\n三种场景的效果：\n1. 旧词新组合（如"量子机器学习"）→ 效果好，子词都有语义\n2. 专有名词（如"张三丰"）→ 中等，姓氏"张"有语义，"三丰"是未知组合\n3. 纯随机 token（如"xYz123"）→ 差，无有效子词，向量接近随机\n\n缓解方案：在文档中增加描述性上下文（如"QLoRA 是一种高效的模型微调方法"），检索时结合 BM25 关键词匹配。',
        visualType: 'comparison'
      }
    ],
    keyTakeaways: [
      'Embedding 模型是"冻结"的——训练后参数不再改变',
      'RAG = 冻结的语义理解 + 可更新的知识库，这是一对最佳搭档',
      'BPE 子词分词让模型能处理训练数据中没见过的新词'
    ]
  }
]

export const concepts: Concept[] = [
  { id: 'c-agent', name: 'Agent（智能体）', category: '应用', difficulty: '入门', explanation: '能自主感知环境、决策并执行动作的 AI 系统。核心是 LLM + 工具 + 记忆 + 规划的循环。', relatedIds: ['c-llm', 'c-tool', 'c-memory', 'c-planning'] },
  { id: 'c-llm', name: 'LLM（大语言模型）', category: '原理', difficulty: '入门', explanation: '基于 Transformer 的大规模语言模型，如 GPT-4、Claude。Agent 的核心"大脑"，负责理解和生成。', relatedIds: ['c-transformer', 'c-attention'] },
  { id: 'c-tool', name: '工具调用（Function Calling）', category: '应用', difficulty: '进阶', explanation: 'LLM 决定调用哪个外部函数、传什么参数的能力。让 LLM 从"说"变成"做"。', relatedIds: ['c-agent', 'c-llm'] },
  { id: 'c-memory', name: '记忆系统', category: '应用', difficulty: '进阶', explanation: 'Agent 对外部状态的读写与管理能力。它不是简单保存聊天记录，而是组合工作记忆、短期摘要、长期事实、向量检索、结构化数据库、缓存、日志和隐私过滤，让 Agent 能在有限上下文窗口内使用历史经验。', relatedIds: ['c-agent', 'c-vector-db', 'c-embedding'] },
  { id: 'c-planning', name: '任务规划', category: '应用', difficulty: '进阶', explanation: '将复杂任务分解为可执行的子步骤。常用方法：思维链（CoT）、ReAct、先规划后执行。', relatedIds: ['c-agent', 'c-reasoning'] },
  { id: 'c-rag', name: 'RAG（检索增强生成）', category: '检索', difficulty: '入门', explanation: '先从外部知识库检索相关文档，再让 LLM 基于这些文档生成答案。解决 LLM 无法访问最新/私有知识的问题。', relatedIds: ['c-embedding', 'c-vector-db', 'c-bm25', 'c-rerank'] },
  { id: 'c-embedding', name: 'Embedding（向量化）', category: '检索', difficulty: '入门', explanation: '把文本转换为固定长度的数值向量。语义相似的文本，向量之间的距离也近。', relatedIds: ['c-rag', 'c-vector-db', 'c-similarity'] },
  { id: 'c-vector-db', name: '向量数据库', category: '检索', difficulty: '进阶', explanation: '专门存储和检索向量数据的数据库，如 ChromaDB、Pinecone。支持基于相似度的快速搜索。', relatedIds: ['c-embedding', 'c-rag'] },
  { id: 'c-bm25', name: 'BM25', category: '检索', difficulty: '进阶', explanation: '经典的关键词检索算法，基于词频和逆文档频率计算相关性。在精确关键词匹配上优于向量检索。', relatedIds: ['c-rag', 'c-rerank'] },
  { id: 'c-rerank', name: '重排序（Reranker）', category: '检索', difficulty: '进阶', explanation: '用更强的模型对检索结果重新打分排序，大幅提升精度。通常用交叉编码器（Cross-Encoder）。', relatedIds: ['c-rag', 'c-bm25'] },
  { id: 'c-hybrid', name: '混合检索（Hybrid Search）', category: '检索', difficulty: '进阶', explanation: '同时使用语义向量检索和关键词检索（BM25），融合两者的结果。兼顾语义理解和精确匹配。', relatedIds: ['c-rag', 'c-bm25', 'c-embedding'] },
  { id: 'c-transformer', name: 'Transformer', category: '原理', difficulty: '入门', explanation: '2017 年提出的神经网络架构，完全基于自注意力机制。GPT、BERT 等所有现代大模型的基础。', relatedIds: ['c-attention', 'c-encoding', 'c-ffn'] },
  { id: 'c-attention', name: '自注意力（Self-Attention）', category: '原理', difficulty: '深入', explanation: '让每个词能动态关注句子中其他词，计算词间关系。核心公式：softmax(QKᵀ/√dₖ)×V。', relatedIds: ['c-transformer', 'c-qkv'] },
  { id: 'c-qkv', name: 'Q/K/V（查询/键/值）', category: '原理', difficulty: '深入', explanation: '注意力机制中的三个核心矩阵。Q 查询"想要什么"，K 匹配"能提供什么"，V 是"实际内容"。', relatedIds: ['c-attention'] },
  { id: 'c-encoding', name: '位置编码', category: '原理', difficulty: '深入', explanation: '为每个词注入位置信息，因为自注意力本身不关心顺序。常用正弦/余弦函数生成。', relatedIds: ['c-transformer', 'c-attention'] },
  { id: 'c-ffn', name: '前馈神经网络（FFN）', category: '原理', difficulty: '进阶', explanation: 'Transformer 层中注意力之后的全连接层，对每个位置独立做非线性变换。通常结构：扩大 4 倍 → 激活 → 还原。', relatedIds: ['c-transformer'] },
  { id: 'c-residual', name: '残差连接与层归一化', category: '原理', difficulty: '进阶', explanation: '残差连接：x + F(x)，让梯度跳层回传。层归一化：稳定训练。两者配合让深层网络能顺利训练。', relatedIds: ['c-transformer'] },
  { id: 'c-chunk', name: '文档切分（Chunking）', category: '检索', difficulty: '进阶', explanation: '将长文档切分为小块的处理步骤。chunk_size 和 chunk_overlap 的选择直接影响 RAG 检索质量。', relatedIds: ['c-rag'] },
  { id: 'c-similarity', name: '余弦相似度', category: '检索', difficulty: '入门', explanation: '衡量两个向量方向接近程度的指标。值域 [-1,1]，越接近 1 表示越相似。', relatedIds: ['c-embedding'] },
  { id: 'c-reasoning', name: '推理（Reasoning）', category: '应用', difficulty: '入门', explanation: 'LLM 分析问题、拆解任务、做出决策的能力。CoT 和 ReAct 是两种主流推理方法。', relatedIds: ['c-agent', 'c-planning'] },
  { id: 'c-hallucination', name: '幻觉（Hallucination）', category: '原理', difficulty: '入门', explanation: 'LLM 生成看似合理但实际错误的内容。RAG 通过引入外部知识能有效减少幻觉。', relatedIds: ['c-rag', 'c-llm'] },
  { id: 'c-async', name: '异步编程（asyncio）', category: '工程', difficulty: '进阶', explanation: 'Python 的异步编程库，让多个 I/O 操作并发执行。Agent 用于并行调用多个工具，大幅降低响应延迟。', relatedIds: ['c-agent', 'c-tool'] },
  { id: 'c-sse', name: 'SSE 流式输出', category: '工程', difficulty: '进阶', explanation: 'Server-Sent Events，服务器向客户端单向推送数据流。让 LLM 回答"边生成边显示"，提升用户体验。', relatedIds: ['c-agent'] },
  { id: 'c-observability', name: '可观测性（Observability）', category: '工程', difficulty: '进阶', explanation: '通过链路追踪、日志和指标监控 Agent 的完整执行过程。主流工具：LangSmith、LangFuse。', relatedIds: ['c-agent', 'c-rag'] },
  { id: 'c-distributional', name: '分布假说', category: '检索', difficulty: '进阶', explanation: '词的含义由它周围词的统计分布决定。"猫"和"狗"向量距离近，是因为它们经常出现在相似的上下文中。', relatedIds: ['c-embedding', 'c-similarity'] },
  { id: 'c-pretrained', name: '预训练模型（冻结语义）', category: '检索', difficulty: '深入', explanation: 'Embedding 模型训练完成后参数冻结，不再更新。RAG 的设计哲学：冻结的语义理解 + 可更新的知识库。', relatedIds: ['c-embedding', 'c-rag'] }
]

export const learningPaths: LearningPath[] = [
  {
    id: 'path-agent',
    title: 'AI 应用开发入门',
    description: '从 Agent 是什么开始，逐步搭建具备工具调用和记忆能力的智能体',
    icon: 'bot',
    cardIds: ['agent-intro', 'agent-tools', 'agent-memory', 'rag-intro', 'rag-customer-service', 'agent-knowledgemap']
  },
  {
    id: 'path-rag',
    title: 'RAG 工程实战',
    description: '深入理解检索增强生成，从文档处理到多路召回、重排序，直至构建智能客服系统',
    icon: 'search',
    cardIds: ['rag-intro', 'rag-chunk', 'embedding-intro', 'embedding-deep', 'rag-advanced', 'rag-customer-service']
  },
  {
    id: 'path-transformer',
    title: 'Transformer 原理',
    description: '从自注意力机制到完整架构，理解大模型底层的数学原理',
    icon: 'brain',
    cardIds: ['transformer-intro', 'attention-mechanism', 'positional-encoding', 'embedding-deep']
  },
  {
    id: 'path-engineering',
    title: '工程部署实战',
    description: '将 Agent 从本地脚本变成线上服务：异步编程、FastAPI 部署、流式输出和可观测性',
    icon: 'server',
    cardIds: ['engineering-async', 'engineering-deploy', 'engineering-monitoring', 'agent-knowledgemap']
  }
]

export const quizzes: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Agent 与普通聊天机器人的核心区别是什么？',
    options: ['Agent 能主动使用工具、制定计划、记住上下文', 'Agent 使用更大的模型', 'Agent 不需要 Prompt', 'Agent 只能做文本生成'],
    correct: 0,
    explanation: 'Agent 的核心特征是具有自主决策能力：能使用工具、制定计划、记住上下文并基于反馈调整行为。普通聊天机器人只能一问一答。',
    conceptIds: ['c-agent']
  },
  {
    id: 'q2',
    question: 'RAG 的核心流程顺序是？',
    options: ['生成 → 检索 → 切分 → 加载', '加载 → 切分 → 向量化 → 检索 → 生成', '向量化 → 切分 → 加载 → 检索', '检索 → 生成 → 切分 → 加载'],
    correct: 1,
    explanation: 'RAG 的五步流程：文档加载(Load) → 文档分割(Split) → 向量化存储(Embed & Store) → 检索(Retrieve) → 生成(Generate)。',
    conceptIds: ['c-rag']
  },
  {
    id: 'q3',
    question: '对自注意力机制来说，以下哪个说法正确？',
    options: ['它只能处理固定长度的序列', '它可以让每个词同时关注句子中的所有其他词', '它需要按顺序一个一个处理词', '它只适用于图像处理'],
    correct: 1,
    explanation: '自注意力的核心优势就是全局并行：每个词可以同时关注所有其他词，计算它们之间的相关度。这正是 Transformer 比 RNN 快的根本原因。',
    conceptIds: ['c-attention']
  },
  {
    id: 'q4',
    question: '向量数据库每次查询都需要重新向量化所有文档吗？',
    options: ['是的，每次查询都重新计算', '不需要，文档向量只需计算一次并持久化存储', '取决于文档大小', '只有使用 OpenAI 时需要'],
    correct: 1,
    explanation: '文档向量在索引构建时计算一次，之后持久化存储在向量数据库中。查询时只需要向量化用户的问题（单个），然后在已存储的向量中检索。',
    conceptIds: ['c-embedding', 'c-vector-db']
  },
  {
    id: 'q5',
    question: 'BM25 和向量检索的区别是？',
    options: ['BM25 更快，向量检索更准', 'BM25 基于关键词精确匹配，向量检索基于语义相似度', '它们完全相同，只是名称不同', 'BM25 是深度学习，向量检索是传统方法'],
    correct: 1,
    explanation: 'BM25 基于词频和逆文档频率做关键词匹配，不涉及语义理解。向量检索把文本转为语义向量，能理解同义词和近似表达。两者互补，混合检索效果最好。',
    conceptIds: ['c-bm25', 'c-rag']
  },
  {
    id: 'q6',
    question: '在 RAG 中，chunk_overlap 的主要作用是？',
    options: ['减少文档总数', '防止关键信息在块与块的边界处断裂', '加快检索速度', '压缩文档大小'],
    correct: 1,
    explanation: 'chunk_overlap 让相邻的文本块有一定的重叠区域。这样如果一个关键概念恰好落在强制分割的边界，它至少在一个完整的块中出现，不会被"切碎"。',
    conceptIds: ['c-chunk']
  },
  {
    id: 'q8',
    question: '重排序（Reranker）应该在哪个阶段使用？',
    options: ['检索之前，优化查询', '检索之后，对少量候选文档重新打分排序', '生成答案之后，修正答案', '文档加载时，优化格式'],
    correct: 1,
    explanation: '重排序的典型用法：先用轻量级方法召回 Top-20/50 候选文档，再用更强的交叉编码器对这些候选重新打分，最终选取 Top-3/5 作为上下文。这样做兼顾了速度和精度。',
    conceptIds: ['c-rerank', 'c-rag']
  },
  {
    id: 'q9',
    question: '为什么"猫"和"狗"的向量相似度远高于"猫"和"汽车"？',
    options: ['因为猫和狗都是动物', '因为它们在训练语料中共享大量相似的上下文语境', '因为 Embedding 模型被人工标注了类别', '因为猫和狗的词形更接近'],
    correct: 1,
    explanation: '这是分布假说（Distributional Hypothesis）的体现：词的含义由它周围词的统计分布决定。"猫"和"狗"在语料中频繁出现在相似上下文中（宠物、饲养、可爱），所以它们的向量距离很近。',
    conceptIds: ['c-distributional', 'c-embedding', 'c-similarity']
  },
  {
    id: 'q12',
    question: 'Agent 中使用 asyncio.gather() 的主要目的是？',
    options: ['让代码更复杂，显得专业', '并行调用多个独立工具，减少总等待时间', '替代 LLM 的推理能力', '让 Agent 能同时服务多个用户'],
    correct: 1,
    explanation: 'asyncio.gather() 让多个独立的 I/O 操作（如调用天气 API、新闻 API）并发执行。总耗时 ≈ max(单个工具耗时)，而非 sum(所有工具耗时)，能显著降低 Agent 的响应延迟。',
    conceptIds: ['c-async', 'c-agent', 'c-tool']
  },
  {
    id: 'q13',
    question: 'SSE（Server-Sent Events）和 WebSocket 的主要区别是什么？',
    options: ['SSE 更快', 'SSE 是单向推送（服务器→客户端），WebSocket 是双向通信', 'SSE 只能发送文本', 'WebSocket 比 SSE 更简单'],
    correct: 1,
    explanation: 'SSE 基于 HTTP 的单向推送协议（服务器→客户端），适合 LLM 逐 token 流式输出。WebSocket 是独立的双向通信协议，适合需要客户端频繁交互的场景。Agent 回答推荐用 SSE。',
    conceptIds: ['c-sse', 'c-agent']
  },
  {
    id: 'q14',
    question: '为什么 RAG 使用"冻结"的 Embedding 模型，而不是微调它？',
    options: ['微调太贵用不起', 'RAG 的设计哲学是冻结的语义理解 + 可更新的知识库，分离"理解"和"存储"', '冻结模型效果更好', '微调会导致模型无法处理新文档'],
    correct: 1,
    explanation: 'RAG 的核心设计哲学是分离关注点：Embedding 模型负责语义理解（冻结不变），向量数据库负责知识存储（随时更新）。这样新知识只需存入数据库而不需重新训练模型，成本低且不会"遗忘"。微调虽能提升特定领域效果，但成本和复杂度远高于简单更新知识库。',
    conceptIds: ['c-pretrained', 'c-embedding', 'c-rag']
  },
  {
    id: 'q15',
    question: 'Agent 的长期记忆为什么通常不能只用向量数据库？',
    options: ['因为向量数据库无法存储文本', '因为向量库擅长语义召回，但不擅长保证唯一性、最新状态、权限和结构化约束', '因为向量数据库只能存图片', '因为关系型数据库一定比向量数据库更智能'],
    correct: 1,
    explanation: '向量数据库适合按语义找相关记忆，但用户资料、权限、任务状态、唯一约束、更新时间等结构化信息更适合关系型数据库或缓存。成熟记忆系统通常组合多种存储。',
    conceptIds: ['c-memory', 'c-vector-db', 'c-agent']
  },
  {
    id: 'q16',
    question: '哪些内容最适合写入 Agent 的长期记忆？',
    options: ['所有原始聊天记录，不做筛选', '用户稳定偏好、项目背景、长期有效事实和可复用经验', '每一次工具调用的临时进度条', '用户输入的所有敏感信息，包括密码和密钥'],
    correct: 1,
    explanation: '长期记忆应该存长期有用、可复用、经过筛选的信息，例如偏好、项目背景、历史决策。临时状态适合短期存储，敏感信息默认不应写入长期记忆。',
    conceptIds: ['c-memory', 'c-agent']
  }
]

// 辅助函数
export function getCardsByModule(module: string): KnowledgeCard[] {
  return knowledgeCards.filter((c) => c.module === module)
}

export function getConceptsByCategory(category: string): Concept[] {
  return concepts.filter((c) => c.category === category)
}

export function getConceptById(id: string): Concept | undefined {
  return concepts.find((c) => c.id === id)
}

export function getCardById(id: string): KnowledgeCard | undefined {
  return knowledgeCards.find((c) => c.id === id)
}

export function getPathById(id: string): LearningPath | undefined {
  return learningPaths.find((p) => p.id === id)
}

export const moduleMeta: Record<string, { name: string; icon: string; color: string }> = {
  agent: { name: 'Agent 智能体', icon: 'bot', color: '#f0c040' },
  rag: { name: 'RAG 检索增强', icon: 'search', color: '#40f0c0' },
  embedding: { name: 'Embedding 向量化', icon: 'layers', color: '#40a0f0' },
  transformer: { name: 'Transformer 原理', icon: 'brain', color: '#f040a0' },
  engineering: { name: '工程部署', icon: 'server', color: '#f0a040' }
}
