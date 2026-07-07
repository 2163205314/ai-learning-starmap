import json
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Read conversations.json and report basic source statistics for future knowledge updates."

    def add_arguments(self, parser):
        parser.add_argument("--file", default="conversations.json")

    def handle(self, *args, **options):
        data_path = Path(options["file"])
        if not data_path.exists():
            data_path = Path.cwd() / options["file"]
        if not data_path.exists():
            self.stdout.write(self.style.WARNING("conversations.json not found."))
            return
        data = json.loads(data_path.read_text(encoding="utf-8"))
        size = len(data) if hasattr(data, "__len__") else 1
        self.stdout.write(self.style.SUCCESS(f"Loaded conversations source successfully. Top-level items: {size}."))
