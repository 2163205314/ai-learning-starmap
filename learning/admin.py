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
