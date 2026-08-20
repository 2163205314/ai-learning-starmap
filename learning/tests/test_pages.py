import json
from unittest import mock

from django.contrib.staticfiles import finders
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from learning.code_runner import RunnerServiceError
from learning.playground_catalog import PLAYGROUND_CHALLENGES, PLAYGROUND_LANGUAGES


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
        self.assertContains(response, "playground-languages")
        self.assertContains(response, reverse("run_code"))
        self.assertContains(response, reverse("code_runner_health"))
        self.assertContains(response, "csrfmiddlewaretoken")
        for language in PLAYGROUND_LANGUAGES:
            with self.subTest(language=language["id"]):
                self.assertContains(response, f'data-language-id="{language["id"]}"')
        self.assertIsNotNone(finders.find("learning/js/code-runner.worker.js"))

    def test_navigation_marks_playground_active(self):
        response = self.client.get(reverse("playground"))

        self.assertContains(response, 'class="active" href="/playground/"')


class PlaygroundCatalogTests(TestCase):
    def test_required_languages_are_available(self):
        language_ids = {language["id"] for language in PLAYGROUND_LANGUAGES}

        self.assertEqual(language_ids, {"c", "cpp", "java", "python", "html", "css", "javascript"})

    def test_language_identifiers_are_unique_and_have_editor_contracts(self):
        identifiers = [language["id"] for language in PLAYGROUND_LANGUAGES]
        self.assertEqual(len(identifiers), len(set(identifiers)))
        for language in PLAYGROUND_LANGUAGES:
            with self.subTest(language=language["id"]):
                self.assertIn(language["mode"], {"worker", "preview", "server"})
                self.assertTrue(language["filename"])
                if language["id"] != "javascript":
                    self.assertTrue(language["starter_code"])

    def test_challenge_identifiers_are_unique(self):
        identifiers = [challenge["id"] for challenge in PLAYGROUND_CHALLENGES]
        self.assertEqual(len(identifiers), len(set(identifiers)))

    def test_each_challenge_has_runnable_contract(self):
        for challenge in PLAYGROUND_CHALLENGES:
            with self.subTest(challenge=challenge["id"]):
                self.assertIn(challenge["entry_point"], challenge["starter_code"])
                self.assertGreaterEqual(len(challenge["tests"]), 2)
                self.assertTrue(challenge["brief"])


class CodeRunnerApiTests(TestCase):
    def post_code(self, payload):
        return self.client.post(reverse("run_code"), data=json.dumps(payload), content_type="application/json")

    @mock.patch("learning.views.runner_health", return_value={"ok": True, "languages": ["python"]})
    def test_runner_health_is_visible_to_frontend(self, runner_health):
        response = self.client.get(reverse("code_runner_health"))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        runner_health.assert_called_once_with()

    @mock.patch("learning.views.execute_code")
    def test_valid_request_returns_isolated_runner_result(self, execute_code):
        execute_code.return_value = {
            "ok": True,
            "phase": "run",
            "exitCode": 0,
            "stdout": "12\n",
            "stderr": "",
            "timedOut": False,
            "duration": 24,
        }

        response = self.post_code({"language": "python", "source": "print(12)"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stdout"], "12\n")
        execute_code.assert_called_once_with("python", "print(12)", "127.0.0.1")

    @mock.patch("learning.views.execute_code")
    def test_unsupported_language_is_rejected_before_runner(self, execute_code):
        response = self.post_code({"language": "javascript", "source": "console.log(1)"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "unsupported_language")
        execute_code.assert_not_called()

    @override_settings(RUNNER_MAX_SOURCE_BYTES=4)
    def test_source_size_is_limited(self):
        response = self.post_code({"language": "python", "source": "print(1)"})

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"], "source_too_large")

    @mock.patch("learning.views.execute_code")
    def test_runner_failure_has_actionable_message(self, execute_code):
        execute_code.side_effect = RunnerServiceError("请启动 Docker Runner。")

        response = self.post_code({"language": "c", "source": "int main(void) { return 0; }"})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["message"], "请启动 Docker Runner。")

    @mock.patch("learning.views.execute_code")
    def test_endpoint_enforces_csrf(self, execute_code):
        execute_code.return_value = {"ok": True, "exitCode": 0}
        client = Client(enforce_csrf_checks=True)
        page = client.get(reverse("playground"))
        token = page.cookies["csrftoken"].value

        rejected = client.post(
            reverse("run_code"),
            data=json.dumps({"language": "python", "source": "print(1)"}),
            content_type="application/json",
        )
        accepted = client.post(
            reverse("run_code"),
            data=json.dumps({"language": "python", "source": "print(1)"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(accepted.status_code, 200)
