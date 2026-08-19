"""Curated browser-side coding exercises.

The catalog owns learning content only. Execution stays in the browser worker,
which keeps exercise definitions independent from UI and transport concerns.
"""

PLAYGROUND_CHALLENGES = [
    {
        "id": "even-sum",
        "index": "01",
        "title": "聚合偶数能量",
        "difficulty": "入门",
        "xp": 120,
        "entry_point": "sumEven",
        "brief": "实现 sumEven(numbers)，返回数组中所有偶数之和。不要修改传入的数组。",
        "concepts": ["数组", "条件判断", "reduce"],
        "hint": "可以先 filter 再 reduce，也可以在一次 reduce 中完成判断。空数组应该返回 0。",
        "starter_code": """function sumEven(numbers) {
  // TODO: 汇总所有偶数
  return 0;
}
""",
        "tests": [
            {"label": "混合整数", "args": [[1, 2, 3, 4, 5, 6]], "expected": 12},
            {"label": "空数组", "args": [[]], "expected": 0},
            {"label": "包含负数", "args": [[-4, -3, 2, 7]], "expected": -2},
        ],
    },
    {
        "id": "signal-filter",
        "index": "02",
        "title": "过滤有效信号",
        "difficulty": "进阶",
        "xp": 180,
        "entry_point": "activeSignals",
        "brief": "实现 activeSignals(signals)，保留 score 大于等于 60 的项，并只返回它们的 name。",
        "concepts": ["对象数组", "filter", "map"],
        "hint": "先用 filter 判断 score，再用 map 提取 name；保持输入顺序不变。",
        "starter_code": """function activeSignals(signals) {
  // TODO: 过滤并提取名称
  return [];
}
""",
        "tests": [
            {
                "label": "过滤阈值",
                "args": [[{"name": "RAG", "score": 91}, {"name": "CNN", "score": 42}, {"name": "Agent", "score": 60}]],
                "expected": ["RAG", "Agent"],
            },
            {"label": "无有效信号", "args": [[{"name": "Noise", "score": 12}]], "expected": []},
        ],
    },
    {
        "id": "frequency-map",
        "index": "03",
        "title": "构建词频矩阵",
        "difficulty": "挑战",
        "xp": 260,
        "entry_point": "wordFrequency",
        "brief": "实现 wordFrequency(text)，忽略大小写，按空白切分文本，并返回每个单词出现次数的对象。",
        "concepts": ["字符串", "哈希表", "归一化"],
        "hint": "先 trim 和 toLowerCase；空字符串直接返回 {}，再逐词累加计数。",
        "starter_code": """function wordFrequency(text) {
  // TODO: 构建 { word: count } 映射
  return {};
}
""",
        "tests": [
            {"label": "重复单词", "args": ["Agent learns agent"], "expected": {"agent": 2, "learns": 1}},
            {"label": "多余空白", "args": ["  RAG   needs context  "], "expected": {"rag": 1, "needs": 1, "context": 1}},
            {"label": "空文本", "args": ["   "], "expected": {}},
        ],
    },
]
