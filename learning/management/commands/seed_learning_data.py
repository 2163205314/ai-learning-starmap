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
        all_module_keys = MODULE_ORDER + [item.get("module") for item in data.get("knowledgeCards", []) if item.get("module") not in MODULE_ORDER]
        for index, key in enumerate(dict.fromkeys(all_module_keys)):
            meta = module_meta.get(key, {})
            modules[key] = Module.objects.create(key=key, name=meta.get("name", key), icon=meta.get("icon", ""), color=meta.get("color", "#40a0f0"), sort_order=index)
        cards = {}
        for card_index, item in enumerate(data.get("knowledgeCards", [])):
            module_key = item.get("module")
            if module_key not in modules:
                continue
            card = KnowledgeCard.objects.create(card_id=item["id"], module=modules[module_key], title=item.get("title", ""), difficulty=item.get("difficulty", "入门"), summary=item.get("summary", ""), key_takeaways=item.get("keyTakeaways", []), sort_order=card_index)
            cards[card.card_id] = card
            for section_index, section in enumerate(item.get("sections", [])):
                KnowledgeSection.objects.create(card=card, title=section.get("title", ""), content=section.get("content", ""), code_example=section.get("codeExample", ""), visual_type=section.get("visualType", ""), sort_order=section_index)
        concepts = {}
        for item in data.get("concepts", []):
            concept = Concept.objects.create(concept_id=item["id"], name=item.get("name", ""), category=item.get("category", "应用"), difficulty=item.get("difficulty", "入门"), explanation=item.get("explanation", ""))
            concepts[concept.concept_id] = concept
        for item in data.get("concepts", []):
            concept = concepts.get(item["id"])
            for related_id in item.get("relatedIds", []):
                related = concepts.get(related_id)
                if concept and related:
                    concept.related.add(related)
        for path_index, item in enumerate(data.get("learningPaths", [])):
            path = LearningPath.objects.create(path_id=item["id"], title=item.get("title", ""), description=item.get("description", ""), icon=item.get("icon", ""), sort_order=path_index)
            for card_index, card_id in enumerate(item.get("cardIds", [])):
                card = cards.get(card_id)
                if card:
                    LearningPathCard.objects.create(path=path, card=card, sort_order=card_index)
        for item in data.get("quizzes", []):
            quiz = QuizQuestion.objects.create(quiz_id=item["id"], question=item.get("question", ""), options=item.get("options", []), correct=item.get("correct", 0), explanation=item.get("explanation", ""))
            for concept_id in item.get("conceptIds", []):
                concept = concepts.get(concept_id)
                if concept:
                    quiz.concepts.add(concept)
        self.stdout.write(self.style.SUCCESS("AI learning data imported successfully."))
