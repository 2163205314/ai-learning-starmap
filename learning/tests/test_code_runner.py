import io
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from learning.code_runner import RunnerServiceError, execute_code, runner_health


class FakeRunnerResponse:
    def __init__(self, body):
        self.body = io.BytesIO(body)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, size=-1):
        return self.body.read(size)


@override_settings(
    RUNNER_SERVICE_URL="http://runner:8081",
    RUNNER_SHARED_TOKEN="test-token",
    RUNNER_REQUESTS_PER_MINUTE=12,
)
class CodeRunnerServiceTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    @mock.patch("learning.code_runner.urllib.request.urlopen")
    def test_runner_protocol_uses_token_and_json(self, urlopen):
        urlopen.return_value = FakeRunnerResponse(b'{"ok": true, "stdout": "42\\n"}')

        result = execute_code("python", "print(42)", "client-a")

        self.assertTrue(result["ok"])
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "http://runner:8081/run")
        self.assertEqual(request.get_header("X-runner-token"), "test-token")
        self.assertIn(b'"language": "python"', request.data)

    @mock.patch("learning.code_runner.urllib.request.urlopen")
    def test_health_check_reports_runner_languages(self, urlopen):
        urlopen.return_value = FakeRunnerResponse(
            b'{"ok": true, "authenticated": true, "languages": ["c", "python"]}'
        )

        result = runner_health()

        self.assertTrue(result["ok"])
        self.assertEqual(result["languages"], ["c", "python"])
        self.assertEqual(urlopen.call_args.args[0].get_header("X-runner-token"), "test-token")

    @override_settings(RUNNER_REQUESTS_PER_MINUTE=1)
    @mock.patch("learning.code_runner.urllib.request.urlopen")
    def test_client_rate_limit_stops_second_request(self, urlopen):
        urlopen.return_value = FakeRunnerResponse(b'{"ok": true}')
        execute_code("python", "print(1)", "client-b")

        with self.assertRaises(RunnerServiceError) as raised:
            execute_code("python", "print(2)", "client-b")

        self.assertEqual(raised.exception.status, 429)
        self.assertEqual(urlopen.call_count, 1)

    @override_settings(RUNNER_SERVICE_URL="", RUNNER_SHARED_TOKEN="")
    def test_missing_runner_configuration_is_actionable(self):
        with self.assertRaisesMessage(RunnerServiceError, "runner.config"):
            execute_code("python", "print(1)", "client-c")
