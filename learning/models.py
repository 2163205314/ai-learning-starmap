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

    def __str__(self):
        return f"{self.path.title} / {self.card.title}"


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
