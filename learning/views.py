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


_EMBEDDING_MODEL = None
_EMBEDDING_IMPORT_ERROR = None


def calculate_similarity(a, b):
    if not a or not b:
        return 0, "empty", {"reason": "请输入两个词"}
    if a == b:
        return 100, "exact-match", {"reason": "两个输入完全一致"}
    from sentence_transformers.util import cos_sim
    model = get_embedding_model()
    embeddings = model.encode([a, b])
    score = float(cos_sim(embeddings[0], embeddings[1])[0][0])
    return round(score * 100, 2), "sentence-transformers", {"dimension": len(embeddings[0]), "vectorPreviewA": [round(float(x), 4) for x in embeddings[0][:8]], "vectorPreviewB": [round(float(x), 4) for x in embeddings[1][:8]]}


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
