"""Curated browser-side coding exercises.

The catalog owns learning content only. Execution stays in the browser worker,
which keeps exercise definitions independent from UI and transport concerns.
"""

PLAYGROUND_LANGUAGES = [
    {
        "id": "javascript",
        "label": "JavaScript",
        "badge": "JS",
        "filename": "solution.js",
        "mode": "worker",
        "runtime": "JS WORKER ONLINE",
        "detail": "TIMEOUT 2000MS",
        "starter_code": "",
    },
    {
        "id": "python",
        "label": "Python",
        "badge": "PY",
        "filename": "solution.py",
        "mode": "server",
        "runtime": "ISOLATED PYTHON",
        "detail": "3S · 256MB · NO NETWORK",
        "starter_code": """def sum_even(numbers):
    # 在独立 Python Runner 接入后可执行
    return sum(number for number in numbers if number % 2 == 0)


print(sum_even([1, 2, 3, 4, 5, 6]))
""",
    },
    {
        "id": "c",
        "label": "C",
        "badge": "C",
        "filename": "solution.c",
        "mode": "server",
        "runtime": "ISOLATED GCC",
        "detail": "3S · 256MB · NO NETWORK",
        "starter_code": """#include <stdio.h>

int sum_even(const int numbers[], int length) {
    int total = 0;
    for (int i = 0; i < length; i++) {
        if (numbers[i] % 2 == 0) total += numbers[i];
    }
    return total;
}

int main(void) {
    int numbers[] = {1, 2, 3, 4, 5, 6};
    printf("%d\\n", sum_even(numbers, 6));
    return 0;
}
""",
    },
    {
        "id": "cpp",
        "label": "C++",
        "badge": "C++",
        "filename": "solution.cpp",
        "mode": "server",
        "runtime": "ISOLATED G++",
        "detail": "3S · 256MB · NO NETWORK",
        "starter_code": """#include <iostream>
#include <vector>

int sumEven(const std::vector<int>& numbers) {
    int total = 0;
    for (int number : numbers) {
        if (number % 2 == 0) total += number;
    }
    return total;
}

int main() {
    std::cout << sumEven({1, 2, 3, 4, 5, 6}) << '\\n';
}
""",
    },
    {
        "id": "java",
        "label": "Java",
        "badge": "JAVA",
        "filename": "Main.java",
        "mode": "server",
        "runtime": "ISOLATED JVM",
        "detail": "3S · 96MB HEAP · NO NETWORK",
        "starter_code": """public class Main {
    static int sumEven(int[] numbers) {
        int total = 0;
        for (int number : numbers) {
            if (number % 2 == 0) total += number;
        }
        return total;
    }

    public static void main(String[] args) {
        System.out.println(sumEven(new int[]{1, 2, 3, 4, 5, 6}));
    }
}
""",
    },
    {
        "id": "html",
        "label": "HTML",
        "badge": "HTML",
        "filename": "index.html",
        "mode": "preview",
        "runtime": "SANDBOX PREVIEW",
        "detail": "SCRIPTS + NETWORK OFF",
        "starter_code": """<main class="signal-card">
  <p class="eyebrow">SYSTEM_SIGNAL</p>
  <h1>Knowledge compiled.</h1>
  <p>在左侧编辑 HTML，然后刷新沙箱预览。</p>
  <button type="button">NEXT MISSION</button>
</main>

<style>
  body { margin: 0; padding: 32px; color: #d7e4ec; background: #071017; font-family: monospace; }
  .signal-card { max-width: 520px; padding: 28px; border: 1px solid #64ffda55; border-radius: 16px; background: #64ffda0a; }
  .eyebrow { color: #64ffda; letter-spacing: .16em; }
  button { padding: 10px 14px; color: #03100d; border: 0; background: #64ffda; }
</style>
""",
    },
    {
        "id": "css",
        "label": "CSS",
        "badge": "CSS",
        "filename": "styles.css",
        "mode": "preview",
        "runtime": "SANDBOX PREVIEW",
        "detail": "SCRIPTS + NETWORK OFF",
        "starter_code": """:root {
  color-scheme: dark;
  --signal: #64ffda;
  --surface: #071017;
}

body {
  margin: 0;
  padding: 32px;
  color: #d7e4ec;
  background: var(--surface);
  font-family: ui-monospace, monospace;
}

.preview-card {
  max-width: 520px;
  padding: 28px;
  border: 1px solid color-mix(in srgb, var(--signal) 35%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--signal) 5%, transparent);
  box-shadow: 0 0 40px #64ffda12;
}

.preview-card span { color: var(--signal); letter-spacing: .16em; }
""",
    },
]


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
