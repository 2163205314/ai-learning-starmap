from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from django.test import SimpleTestCase

import manage
from scripts import bootstrap


class BootstrapModelDownloadTests(SimpleTestCase):
    def test_existing_complete_model_skips_download(self):
        with TemporaryDirectory() as temp_dir:
            model_dir = Path(temp_dir)
            for filename in bootstrap.MODEL_REQUIRED_FILES:
                (model_dir / filename).write_text("{}", encoding="utf-8")

            with mock.patch.object(bootstrap, "MODEL_DIR", model_dir), mock.patch.object(bootstrap, "run") as run:
                self.assertTrue(bootstrap.download_embedding_model())

            run.assert_not_called()

    def test_missing_model_uses_hugging_face_and_exposes_manual_url(self):
        with TemporaryDirectory() as temp_dir:
            model_dir = Path(temp_dir) / "model"
            with mock.patch.object(bootstrap, "MODEL_DIR", model_dir), mock.patch.object(
                bootstrap, "run", return_value=False
            ) as run:
                self.assertFalse(bootstrap.download_embedding_model())

            command, label, hints = run.call_args.args
            self.assertEqual(command[:2], [str(bootstrap.PYTHON), "-c"])
            self.assertIn(bootstrap.MODEL_REPO_ID, command[2])
            self.assertEqual(label, "下载本地 Embedding 模型")
            self.assertTrue(any(bootstrap.MODEL_DOWNLOAD_URL in hint for hint in hints))


class BootstrapArgumentTests(SimpleTestCase):
    def test_ml_install_is_opt_in(self):
        with mock.patch.object(bootstrap.sys, "argv", ["bootstrap.py", "--no-server"]):
            args = bootstrap.parse_args()

        self.assertFalse(args["with_ml"])
        self.assertTrue(args["no_server"])

    def test_with_ml_flag_enables_real_model_setup(self):
        with mock.patch.object(bootstrap.sys, "argv", ["bootstrap.py", "--with-ml"]):
            args = bootstrap.parse_args()

        self.assertTrue(args["with_ml"])

    def test_no_lsp_flag_skips_language_server_setup(self):
        with mock.patch.object(bootstrap.sys, "argv", ["bootstrap.py", "--no-lsp"]):
            args = bootstrap.parse_args()

        self.assertTrue(args["no_lsp"])


class BootstrapRunnerTests(SimpleTestCase):
    @mock.patch("scripts.bootstrap.shutil.which", return_value=None)
    @mock.patch("scripts.bootstrap.run")
    def test_missing_docker_keeps_runner_optional(self, run, _which):
        self.assertFalse(bootstrap.start_docker_runner({"mode": "docker", "host": "127.0.0.1", "port": 8765}))
        run.assert_not_called()

    @mock.patch("scripts.bootstrap.shutil.which", return_value="docker")
    @mock.patch("scripts.bootstrap.run", return_value=True)
    def test_docker_mode_starts_compose_runner(self, run, _which):
        with mock.patch.dict(bootstrap.os.environ, {}, clear=True):
            self.assertTrue(bootstrap.start_docker_runner({"mode": "docker", "host": "127.0.0.1", "port": 9000}))
            self.assertEqual(bootstrap.os.environ["RUNNER_PUBLISH_HOST"], "127.0.0.1")
            self.assertEqual(bootstrap.os.environ["RUNNER_PUBLISH_PORT"], "9000")

        command = run.call_args.args[0]
        self.assertEqual(command, ["docker", "compose", "up", "-d", "--build", "runner"])

    def test_runner_config_defaults_to_local(self):
        with TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "runner.config"
            config_path.write_text("[runner]\nmode = local\nhost = 127.0.0.1\nport = 9000\n", encoding="utf-8")
            with mock.patch.object(bootstrap, "RUNNER_CONFIG_PATH", config_path):
                config = bootstrap.load_runner_config()

        self.assertEqual(config, {"mode": "local", "host": "127.0.0.1", "port": 9000})

    def test_missing_runner_config_defaults_to_local(self):
        with TemporaryDirectory() as temp_dir, mock.patch.object(
            bootstrap, "RUNNER_CONFIG_PATH", Path(temp_dir) / "missing.config"
        ):
            config = bootstrap.load_runner_config()

        self.assertEqual(config, {"mode": "local", "host": "127.0.0.1", "port": 8765})

    @mock.patch("scripts.bootstrap.start_local_runner", return_value=True)
    @mock.patch("scripts.bootstrap.get_runner_token", return_value="generated-token")
    @mock.patch("scripts.bootstrap.load_runner_config", return_value={"mode": "local", "host": "127.0.0.1", "port": 8765})
    def test_start_code_runner_uses_configured_local_mode(self, _config, _token, start_local_runner):
        with mock.patch.dict(bootstrap.os.environ, {}, clear=True):
            self.assertTrue(bootstrap.start_code_runner())
            self.assertEqual(bootstrap.os.environ["RUNNER_SHARED_TOKEN"], "generated-token")
            self.assertEqual(bootstrap.os.environ["RUNNER_SERVICE_URL"], "http://127.0.0.1:8765")

        start_local_runner.assert_called_once_with({"mode": "local", "host": "127.0.0.1", "port": 8765})


class ManageRunnerLifecycleTests(SimpleTestCase):
    @mock.patch("django.core.management.execute_from_command_line")
    @mock.patch("scripts.bootstrap.stop_lsp_gateway")
    @mock.patch("scripts.bootstrap.stop_local_runner")
    @mock.patch("scripts.bootstrap.start_lsp_gateway", return_value=True)
    @mock.patch("scripts.bootstrap.start_code_runner", return_value=True)
    def test_direct_runserver_starts_and_stops_local_services(self, start_runner, start_lsp, stop_runner, stop_lsp, execute):
        with mock.patch.object(manage.sys, "argv", ["manage.py", "runserver"]), mock.patch.dict(
            manage.os.environ, {"RUN_MAIN": ""}
        ):
            manage.main()

        start_runner.assert_called_once_with()
        start_lsp.assert_called_once_with()
        execute.assert_called_once_with(["manage.py", "runserver"])
        stop_runner.assert_called_once_with()
        stop_lsp.assert_called_once_with()

    @mock.patch("django.core.management.execute_from_command_line")
    @mock.patch("scripts.bootstrap.start_lsp_gateway")
    @mock.patch("scripts.bootstrap.start_code_runner")
    def test_non_runserver_command_does_not_start_local_services(self, start_runner, start_lsp, execute):
        with mock.patch.object(manage.sys, "argv", ["manage.py", "check"]):
            manage.main()

        start_runner.assert_not_called()
        start_lsp.assert_not_called()
        execute.assert_called_once_with(["manage.py", "check"])
