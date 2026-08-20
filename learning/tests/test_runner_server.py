from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from django.test import SimpleTestCase

from runner import runner_server


class RunnerServerTests(SimpleTestCase):
    def temporary_directory(self, path):
        context = mock.MagicMock()
        context.__enter__.return_value = path
        context.__exit__.return_value = False
        return context

    def test_command_is_wrapped_with_process_resource_limits(self):
        with mock.patch.object(runner_server, "PRLIMIT", "prlimit"):
            command = runner_server.limited_command(["python", "main.py"], 256 * 1024 * 1024)

        self.assertEqual(command[0], "prlimit")
        self.assertIn("--cpu=2", command)
        self.assertIn("--nproc=32", command)
        self.assertIn(f"--fsize={runner_server.OUTPUT_FILE_LIMIT}", command)
        self.assertIn("--as=268435456", command)
        self.assertEqual(command[-2:], ["python", "main.py"])

    @mock.patch("runner.runner_server.run_command")
    def test_python_source_is_written_then_executed(self, run_command):
        run_command.return_value = {
            "exitCode": 0,
            "stdout": "42\n",
            "stderr": "",
            "timedOut": False,
            "outputLimited": False,
            "duration": 10,
        }
        with TemporaryDirectory() as temp_dir, mock.patch(
            "runner.runner_server.tempfile.TemporaryDirectory",
            return_value=self.temporary_directory(temp_dir),
        ):
            result = runner_server.execute("python", "print(42)")

            self.assertEqual((Path(temp_dir) / "main.py").read_text(encoding="utf-8"), "print(42)")

        self.assertTrue(result["ok"])
        self.assertEqual(run_command.call_args.args[0], [runner_server.sys.executable, "-I", "-S", "main.py"])

    @mock.patch("runner.runner_server.run_command")
    def test_compile_failure_does_not_run_binary(self, run_command):
        run_command.return_value = {
            "exitCode": 1,
            "stdout": "",
            "stderr": "compile error",
            "timedOut": False,
            "outputLimited": False,
            "duration": 8,
        }
        with TemporaryDirectory() as temp_dir, mock.patch(
            "runner.runner_server.tempfile.TemporaryDirectory",
            return_value=self.temporary_directory(temp_dir),
        ):
            result = runner_server.execute("c", "not valid c")

        self.assertFalse(result["ok"])
        self.assertEqual(result["phase"], "compile")
        self.assertEqual(run_command.call_count, 1)

    def test_local_python_runs_and_removes_temporary_script(self):
        temp_root = Path(runner_server.tempfile.gettempdir())
        before = set(temp_root.glob("atlas-run-*"))

        result = runner_server.execute("python", "print('local-result')")
        after = set(temp_root.glob("atlas-run-*"))

        self.assertTrue(result["ok"])
        self.assertEqual(result["stdout"].strip(), "local-result")
        self.assertEqual(after, before)
