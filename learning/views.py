import math
from pathlib import Path

from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .models import Concept, KnowledgeCard, KnowledgeSection, LearningPath, Module, QuizQuestion


BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_EMBEDDING_MODEL = BASE_DIR / "models" / "paraphrase-multilingual-MiniLM-L12-v2"


MODULE_QUIZ_CONCEPTS = {
    "agent": ["c-agent", "c-tool", "c-memory", "c-planning"],
    "rag": ["c-rag", "c-chunk", "c-bm25", "c-rerank", "c-hybrid"],
    "embedding": ["c-embedding", "c-similarity", "c-distributional", "c-pretrained"],
    "transformer": ["c-transformer", "c-attention", "c-qkv", "c-encoding", "c-ffn", "c-residual"],
    "engineering": ["c-async", "c-sse", "c-observability"],
}


def home(request):
    modules = Module.objects.all()
    paths = LearningPath.objects.prefetch_related("cards")
    concepts = Concept.objects.filter(concept_id__in=["c-agent", "c-rag", "c-embedding", "c-transformer", "c-attention", "c-memory"])
    return render(request, "learning/home.html", {"modules": modules, "paths": paths, "star_concepts": concepts})


def courses(request):
    modules = Module.objects.all()
    paths = LearningPath.objects.all()
    selected_module = request.GET.get("module") or "agent"
    selected_path = request.GET.get("path")
    cards_query = KnowledgeCard.objects.select_related("module").prefetch_related(Prefetch("sections", queryset=KnowledgeSection.objects.all()))
    path = None
    if selected_path:
        path = LearningPath.objects.filter(path_id=selected_path).prefetch_related("cards__sections").first()
        cards = list(path.cards.all()) if path else []
        title = path.title if path else "学习路径"
        quiz_concepts = set()
        for card in cards:
            quiz_concepts.update(MODULE_QUIZ_CONCEPTS.get(card.module.key, []))
    else:
        cards = cards_query.filter(module__key=selected_module)
        title = Module.objects.filter(key=selected_module).values_list("name", flat=True).first() or "课程学习"
        quiz_concepts = MODULE_QUIZ_CONCEPTS.get(selected_module, [])
    quizzes = QuizQuestion.objects.filter(concepts__concept_id__in=quiz_concepts).prefetch_related("concepts").distinct()
    return render(request, "learning/courses.html", {"modules": modules, "paths": paths, "cards": cards, "quizzes": quizzes, "selected_module": selected_module, "selected_path": selected_path, "page_title": title, "active_path": path})


def lab(request):
    return render(request, "learning/lab.html")


def project(request):
    steps = [
        ("文档准备", "收集 FAQ、政策、产品说明，清洗隐私信息"),
        ("文档切分", "按语义边界切块，控制 chunk_size 与 overlap"),
        ("向量化存储", "使用 Embedding 模型写入向量数据库"),
        ("多路检索", "结合 BM25、向量检索与业务过滤"),
        ("重排序", "用 Reranker 将最相关片段放到前面"),
        ("Agent 回答", "组合上下文、工具与引用生成可信回答"),
    ]
    token_budget = [("系统 Prompt", 400, "purple"), ("对话历史", 800, "blue"), ("检索上下文", 1200, "cyan"), ("用户问题", 100, "orange"), ("生成预留", 500, "pink")]
    latency = [("Embedding", 200, 500), ("BM25 检索", 50, 150), ("向量检索", 100, 300), ("Reranker", 300, 800), ("LLM 生成", 1500, 4000)]
    return render(request, "learning/project.html", {"steps": steps, "token_budget": token_budget, "latency": latency, "max_tokens": 4096})


def glossary(request):
    query = request.GET.get("q", "").strip()
    category = request.GET.get("category", "all")
    concepts = Concept.objects.prefetch_related("related")
    if category != "all":
        concepts = concepts.filter(category=category)
    if query:
        concepts = concepts.filter(Q(name__icontains=query) | Q(explanation__icontains=query) | Q(category__icontains=query) | Q(difficulty__icontains=query))
    return render(request, "learning/glossary.html", {"concepts": concepts, "query": query, "category": category, "categories": ["应用", "检索", "原理", "工程"]})


@require_POST
def check_quiz(request):
    quiz_id = request.POST.get("quiz_id")
    try:
        selected = int(request.POST.get("selected", -1))
    except ValueError:
        selected = -1
    quiz = QuizQuestion.objects.get(quiz_id=quiz_id)
    return JsonResponse({"correct": selected == quiz.correct, "correctIndex": quiz.correct, "explanation": quiz.explanation})


@require_GET
def embedding_similarity(request):
    a = request.GET.get("a", "").strip()
    b = request.GET.get("b", "").strip()
    score, method, details = calculate_similarity(a, b)
    return JsonResponse({"a": a, "b": b, "score": score, "method": method, "details": details})


SEMANTIC_GROUPS = {
    "猫科动物": {"猫", "虎", "老虎", "狮子", "豹", "雪豹", "猞猁"},
    "宠物": {"猫", "狗", "兔子", "仓鼠", "鼠", "老鼠", "豚鼠", "鹦鹉"},
    "啮齿动物": {"鼠", "老鼠", "仓鼠", "豚鼠", "松鼠"},
    "动物": {"猫", "狗", "兔子", "仓鼠", "鼠", "老鼠", "虎", "老虎", "狮子", "豹", "牛", "羊", "马", "鸟", "鱼"},
    "水果": {"苹果", "香蕉", "葡萄", "橙子", "梨", "桃子", "西瓜", "草莓"},
    "城市": {"北京", "上海", "广州", "深圳"},
    "编程语言": {"Python", "Java", "JavaScript", "Go", "python", "java"},
    "电商": {"退款", "退货", "换货", "订单"},
    "天气": {"天气", "下雨", "雨伞", "晴天"},
    "情绪": {"快乐", "悲伤", "开心", "难过"},
}

SEMANTIC_ALIASES = {
    "老虎": "虎",
    "小猫": "猫",
    "猫咪": "猫",
    "老鼠": "鼠",
    "耗子": "鼠",
    "python": "Python",
    "java": "Java",
}

_EMBEDDING_MODEL = None
_EMBEDDING_IMPORT_ERROR = None


def calculate_similarity(a, b):
    if not a or not b:
        return 0, "empty", {"reason": "请输入两个词"}
    if a == b:
        return 100, "exact-match", {"reason": "两个输入完全一致"}
    try:
        from sentence_transformers.util import cos_sim
        model = get_embedding_model()
        embeddings = model.encode([a, b])
        score = float(cos_sim(embeddings[0], embeddings[1])[0][0])
        return round(score * 100, 2), "sentence-transformers", {"dimension": len(embeddings[0]), "vectorPreviewA": [round(float(x), 4) for x in embeddings[0][:8]], "vectorPreviewB": [round(float(x), 4) for x in embeddings[1][:8]]}
    except Exception as exc:
        score, method, details = fallback_similarity(a, b)
        details["modelStatus"] = "真实 Embedding 模型未加载，当前使用增强模拟兜底"
        details["modelError"] = str(exc)
        return score, method, details


def get_embedding_model():
    global _EMBEDDING_MODEL, _EMBEDDING_IMPORT_ERROR
    if _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL
    if _EMBEDDING_IMPORT_ERROR is not None:
        raise _EMBEDDING_IMPORT_ERROR
    try:
        from sentence_transformers import SentenceTransformer
        model_path = str(LOCAL_EMBEDDING_MODEL) if LOCAL_EMBEDDING_MODEL.exists() else "paraphrase-multilingual-MiniLM-L12-v2"
        _EMBEDDING_MODEL = SentenceTransformer(model_path)
        return _EMBEDDING_MODEL
    except Exception as exc:
        _EMBEDDING_IMPORT_ERROR = exc
        raise exc


def fallback_similarity(a, b):
    norm_a = normalize_semantic_word(a)
    norm_b = normalize_semantic_word(b)
    categories_a = categories_for_word(norm_a)
    categories_b = categories_for_word(norm_b)
    shared_categories = categories_a & categories_b
    if shared_categories:
        score = simulated_category_score(norm_a, norm_b, shared_categories)
        return score, "enhanced-simulated-semantic", {"reason": f"共享语义类别：{'、'.join(sorted(shared_categories))}，增强模拟结果", "sharedCategories": sorted(shared_categories)}
    set_a = set(norm_a.lower())
    set_b = set(norm_b.lower())
    union = set_a | set_b
    char_score = 0 if not union else len(set_a & set_b) / len(union) * 100
    length_score = min(len(norm_a), len(norm_b)) / max(len(norm_a), len(norm_b)) * 20 if norm_a and norm_b else 0
    score = min(65, char_score * 0.75 + length_score)
    return round(score, 2), "character-fallback", {"reason": "未命中语义词库，使用字符集合与长度相似度兜底，模拟结果"}


def normalize_semantic_word(word):
    value = word.strip()
    return SEMANTIC_ALIASES.get(value, value)


def categories_for_word(word):
    return {category for category, words in SEMANTIC_GROUPS.items() if word in words}


def simulated_category_score(a, b, shared_categories):
    if a == b:
        return 100
    if "猫科动物" in shared_categories:
        return 86
    if "啮齿动物" in shared_categories:
        return 84
    if "宠物" in shared_categories:
        return 76
    if "动物" in shared_categories:
        return 68
    if "电商" in shared_categories:
        return 78
    return 72
