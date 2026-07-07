const documentText = "智能客服知识库包含退款政策、会员权益、物流时效、发票规则和异常工单处理方案。RAG 系统会先加载这些企业文档，再按语义边界切成多个 chunk。合理的 chunk_size 可以保留完整信息，chunk_overlap 可以避免边界处的重要上下文断裂。检索阶段会根据用户问题召回最相关片段，重排序后交给语言模型生成答案，并附带来源引用。"

const ragSteps = {
  load: { title: "加载知识源", detail: "读取 FAQ、产品文档、工单和政策文件，同时保留来源、更新时间、权限标签等元数据。", input: "PDF、Markdown、网页、工单记录", output: "带元数据的文档对象", risk: "权限混乱会导致越权检索" },
  split: { title: "文档切分", detail: "按标题、段落和语义边界拆成 chunk，避免把一个完整流程切断。", input: "长文档", output: "可检索文本块", risk: "chunk 太小会丢上下文，太大会浪费 token" },
  embed: { title: "向量化", detail: "用 Embedding 模型把 chunk 转成向量，语义相近的文本在向量空间中距离更近。", input: "chunk 文本", output: "向量 + 原文 + 元数据", risk: "模型更换后需要重新向量化" },
  retrieve: { title: "检索召回", detail: "根据用户问题召回候选 chunk，可结合 BM25、向量检索和业务过滤。", input: "用户问题向量", output: "候选知识片段", risk: "只用单路检索可能漏掉关键词强相关内容" },
  rerank: { title: "重排序", detail: "用 Reranker 逐条评估问题与候选片段相关性，把最有用证据放到前面。", input: "候选片段列表", output: "排序后的 Top-K 上下文", risk: "重排序延迟较高，需要设置超时降级" },
  generate: { title: "生成回答", detail: "把系统提示词、用户问题和检索上下文组合成 Prompt，生成可引用、可追溯的答案。", input: "问题 + Top-K 上下文", output: "带引用的客服回答", risk: "上下文不足时需要拒答或追问" },
}

const attentionStages = {
  score: { step: "Step 1", title: "QKᵀ：先算“匹配分”", text: "每个 token 都拿自己的 Q 去和所有 token 的 K 做点积。它不是最终概率，只是粗略回答：我和谁更相关？", formula: "score = Q · Kᵀ", input: "Q 矩阵、K 矩阵", output: "每个 token 对其他 token 的原始关注分数", read: "看一行：这一行的词正在决定关注谁；看一列：这一列的词被多少关注。颜色越亮，分数越高。", summary: "例如“调用”这一行同时关注“Agent”和“工具”，因为“调用”需要知道谁发起调用、调用什么。", matrix: [[0.88, 0.42, 0.30], [0.62, 0.71, 0.83], [0.28, 0.58, 0.76]], rowLabels: ["Agent 的 Q", "调用 的 Q", "工具 的 Q"], colLabels: ["Agent 的 K", "调用 的 K", "工具 的 K"] },
  scale: { step: "Step 2", title: "除以 √dₖ：把分数压稳", text: "向量维度越大，点积越容易变得很大。直接进入 Softmax 会让最大值一家独大，所以要先除以 √dₖ。", formula: "scaled_score = score / √dₖ", input: "上一步的原始匹配分、Key 向量维度 dₖ", output: "更平滑、更稳定的匹配分", read: "矩阵形状不变，亮暗关系也大致不变，只是数值被压到更适合 Softmax 的范围。", summary: "这一步像给音量降噪：保留谁更重要，但避免某个分数大到压死其他信息。", matrix: [[0.51, 0.24, 0.17], [0.36, 0.41, 0.48], [0.16, 0.33, 0.44]], rowLabels: ["Agent", "调用", "工具"], colLabels: ["Agent", "调用", "工具"] },
  softmax: { step: "Step 3", title: "Softmax：变成“注意力比例”", text: "Softmax 会把每一行转成 0~1 的权重，并且每一行加起来等于 1。现在才是真正的“关注比例”。", formula: "attention_weight = softmax(scaled_score)", input: "缩放后的匹配分", output: "每个 token 分配给其他 token 的注意力权重", read: "每一行单独看，总和是 1。比如“调用”这一行中，“工具”最亮，表示调用更需要参考工具。", summary: "到这一步，模型已经决定：理解“调用”时，应该把最多注意力放在“工具”，其次是“Agent”。", matrix: [[0.43, 0.31, 0.26], [0.30, 0.32, 0.38], [0.28, 0.33, 0.39]], rowLabels: ["Agent 关注谁", "调用 关注谁", "工具 关注谁"], colLabels: ["Agent", "调用", "工具"] },
  value: { step: "Step 4", title: "乘以 V：按权重汇总信息", text: "最后用注意力权重去加权求和 V。输出不再只是原来的单词，而是融合上下文后的新表示。", formula: "output = attention_weight · V", input: "注意力权重矩阵、V 矩阵", output: "融合上下文后的 token 表示", read: "这里展示的是新表示的 3 个示意维度。数值不是关注比例，而是融合后的特征强度。", summary: "最终“调用”的表示已经吸收了“Agent”和“工具”的信息，所以模型更容易理解“Agent 调用工具”是一件完整动作。", matrix: [[0.66, 0.38, 0.47], [0.72, 0.46, 0.69], [0.60, 0.52, 0.74]], rowLabels: ["Agent 新表示", "调用 新表示", "工具 新表示"], colLabels: ["维度 1", "维度 2", "维度 3"] },
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest(".tab-list button")
  if (tab) {
    document.querySelectorAll(".tab-list button").forEach((button) => button.classList.remove("active"))
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"))
    tab.classList.add("active")
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active")
  }
  const ragNode = event.target.closest(".rag-node")
  if (ragNode) activateRagStep(ragNode.dataset.step)
  const pair = event.target.closest(".preset-pairs button")
  if (pair) {
    const [a, b] = pair.textContent.split("|")
    document.getElementById("wordA").value = a
    document.getElementById("wordB").value = b
  }
  if (event.target.id === "calcSimilarity") {
    const a = encodeURIComponent(document.getElementById("wordA").value)
    const b = encodeURIComponent(document.getElementById("wordB").value)
    const response = await fetch(`/api/embedding/similarity/?a=${a}&b=${b}`)
    const data = await response.json()
    renderSimilarity(data)
  }
  const attentionButton = event.target.closest(".attention-steps button")
  if (attentionButton) {
    document.querySelectorAll(".attention-steps button").forEach((button) => button.classList.remove("active"))
    attentionButton.classList.add("active")
    renderAttention(attentionButton.dataset.attention)
  }
})

document.addEventListener("keydown", (event) => {
  const ragNode = event.target.closest?.(".rag-node")
  if (ragNode && (event.key === "Enter" || event.key === " ")) activateRagStep(ragNode.dataset.step)
})

function activateRagStep(stepKey) {
  const step = ragSteps[stepKey]
  if (!step) return
  document.querySelectorAll(".rag-node").forEach((node) => node.classList.toggle("active", node.dataset.step === stepKey))
  document.getElementById("ragTitle").textContent = step.title
  document.getElementById("ragDetail").textContent = step.detail
  document.getElementById("ragInput").textContent = step.input
  document.getElementById("ragOutput").textContent = step.output
  document.getElementById("ragRisk").textContent = step.risk
}

function renderChunks() {
  const size = Number(document.getElementById("chunkSize").value)
  const overlap = Number(document.getElementById("chunkOverlap").value)
  const step = Math.max(1, size - overlap)
  const chunks = []
  for (let index = 0; index < documentText.length; index += step) chunks.push(documentText.slice(index, index + size))
  const average = Math.round(chunks.reduce((sum, item) => sum + item.length, 0) / chunks.length)
  document.getElementById("chunkSizeValue").textContent = size
  document.getElementById("chunkOverlapValue").textContent = overlap
  document.getElementById("chunkStats").innerHTML = `<article><b>${documentText.length}</b><span>文档长度</span></article><article><b>${chunks.length}</b><span>切块数量</span></article><article><b>${average}</b><span>平均块长</span></article><article><b>${Math.round(overlap / size * 100)}%</b><span>重叠比例</span></article>`
  document.getElementById("chunkAdvice").textContent = getChunkAdvice(size, overlap, chunks.length)
  document.getElementById("chunkPreview").innerHTML = chunks.slice(0, 5).map((chunk, index) => `<article><header><b>Chunk ${index + 1}</b><span>${chunk.length} 字</span></header><p>${highlightOverlap(chunk, overlap, index)}</p></article>`).join("")
}

function getChunkAdvice(size, overlap, count) {
  if (overlap >= size * 0.45) return "重叠比例偏高：召回更稳，但会制造大量重复 token，生产环境需控制成本。"
  if (size < 250) return "chunk_size 偏小：适合精准问答，但复杂规则可能被切断，需要更高 overlap。"
  if (size > 800) return "chunk_size 偏大：上下文更完整，但检索粒度变粗，可能把无关内容一起塞给模型。"
  return `当前参数较均衡：预计生成 ${count} 个 chunk，适合 FAQ、客服政策和短文档知识库。`
}

function highlightOverlap(chunk, overlap, index) {
  if (!index || !overlap) return chunk
  const overlapText = chunk.slice(0, Math.min(overlap, chunk.length))
  return `<mark>${overlapText}</mark>${chunk.slice(overlapText.length)}`
}

function renderSimilarity(data) {
  const score = Math.max(0, Math.min(100, Number(data.score) || 0))
  document.getElementById("similarityNeedle").style.width = `${score}%`
  document.getElementById("similarityScore").textContent = `${score}%`
  document.getElementById("similarityTitle").textContent = `${data.a} ↔ ${data.b}`
  document.getElementById("similarityMethod").textContent = `计算方式：${data.method}。${data.details.reason || "返回向量余弦相似度。"}`
  const vector = data.details.vectorPreviewA || [0.12, -0.08, 0.31, 0.44, -0.22, 0.18, 0.09, -0.14]
  document.getElementById("vectorPreview").innerHTML = vector.map((value) => `<span style="height:${Math.max(12, Math.abs(value) * 70)}px" title="${value}"></span>`).join("")
  document.getElementById("similarityResult").textContent = JSON.stringify(data, null, 2)
}

function renderAttention(stageKey) {
  const stage = attentionStages[stageKey]
  if (!stage) return
  document.getElementById("attentionTitle").textContent = stage.title
  document.getElementById("attentionText").textContent = stage.text
  document.getElementById("attentionFormula").textContent = stage.formula
  document.getElementById("attentionStepLabel").textContent = stage.step
  document.getElementById("attentionInput").textContent = stage.input
  document.getElementById("attentionOutput").textContent = stage.output
  document.getElementById("attentionRead").textContent = stage.read
  document.getElementById("attentionSummary").textContent = stage.summary
  document.getElementById("matrixStage").innerHTML = `<div class="matrix-help"><b>行 = 当前正在理解的 token</b><span>列 = 它可以参考的信息来源</span></div><div class="matrix-table"><div class="matrix-corner">Q \ K/V</div>${stage.colLabels.map((label) => `<div class="matrix-col-label">${label}</div>`).join("")}${stage.matrix.map((row, rowIndex) => `<div class="matrix-row-label">${stage.rowLabels[rowIndex]}</div>${row.map((value, colIndex) => `<button class="matrix-cell" style="--heat:${value}" data-value="${value.toFixed(2)}" data-row="${stage.rowLabels[rowIndex]}" data-col="${stage.colLabels[colIndex]}">${value.toFixed(2)}</button>`).join("")}`).join("")}</div><p class="matrix-caption" id="matrixCaption">点击或悬停矩阵格子查看它代表的含义。</p>`
}

document.addEventListener("mouseover", updateMatrixCaption)
document.addEventListener("click", updateMatrixCaption)

function updateMatrixCaption(event) {
  const cell = event.target.closest(".matrix-cell")
  if (!cell) return
  const caption = document.getElementById("matrixCaption")
  if (caption) caption.textContent = `${cell.dataset.row} → 参考 ${cell.dataset.col}：数值 ${cell.dataset.value}，颜色越亮表示影响越大。`
}

document.getElementById("chunkSize")?.addEventListener("input", renderChunks)
document.getElementById("chunkOverlap")?.addEventListener("input", renderChunks)
renderChunks()
renderAttention("score")
