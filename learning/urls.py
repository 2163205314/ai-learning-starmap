from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("courses/", views.courses, name="courses"),
    path("lab/", views.lab, name="lab"),
    path("playground/", views.playground, name="playground"),
    path("project/", views.project, name="project"),
    path("glossary/", views.glossary, name="glossary"),
    path("api/quiz/check/", views.check_quiz, name="check_quiz"),
    path("api/code/run/", views.run_code, name="run_code"),
    path("api/code/health/", views.code_runner_health, name="code_runner_health"),
    path("api/embedding/similarity/", views.embedding_similarity, name="embedding_similarity"),
]
