from django.contrib.staticfiles import finders
from django.test import TestCase
from django.urls import reverse

from learning.playground_catalog import PLAYGROUND_CHALLENGES


class PublicPageTests(TestCase):
    def test_public_pages_render(self):
        for route_name in ["home", "courses", "lab", "playground", "project", "glossary"]:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)

    def test_playground_exposes_catalog_and_worker(self):
        response = self.client.get(reverse("playground"))

        self.assertContains(response, "代码工坊")
        self.assertContains(response, PLAYGROUND_CHALLENGES[0]["id"])
        self.assertContains(response, "playground-data")
        self.assertIsNotNone(finders.find("learning/js/code-runner.worker.js"))

    def test_navigation_marks_playground_active(self):
        response = self.client.get(reverse("playground"))

        self.assertContains(response, 'class="active" href="/playground/"')


class PlaygroundCatalogTests(TestCase):
    def test_challenge_identifiers_are_unique(self):
        identifiers = [challenge["id"] for challenge in PLAYGROUND_CHALLENGES]
        self.assertEqual(len(identifiers), len(set(identifiers)))

    def test_each_challenge_has_runnable_contract(self):
        for challenge in PLAYGROUND_CHALLENGES:
            with self.subTest(challenge=challenge["id"]):
                self.assertIn(challenge["entry_point"], challenge["starter_code"])
                self.assertGreaterEqual(len(challenge["tests"]), 2)
                self.assertTrue(challenge["brief"])
