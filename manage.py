#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ai_learning.settings")
    runner_lifecycle = None
    is_runserver_parent = "runserver" in sys.argv[1:] and os.environ.get("RUN_MAIN") != "true"
    if is_runserver_parent:
        from scripts import bootstrap

        runner_lifecycle = bootstrap
        if not runner_lifecycle.start_code_runner():
            print("提示: 代码 Runner 启动失败，网站会继续启动；请检查 runner.config 和上方日志。")

    from django.core.management import execute_from_command_line

    try:
        execute_from_command_line(sys.argv)
    finally:
        if runner_lifecycle is not None:
            runner_lifecycle.stop_local_runner()


if __name__ == "__main__":
    main()
