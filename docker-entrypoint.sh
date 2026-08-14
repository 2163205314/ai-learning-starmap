#!/bin/sh
set -eu

python manage.py migrate --noinput

if ! python manage.py shell -c "from learning.models import KnowledgeCard; raise SystemExit(0 if KnowledgeCard.objects.exists() else 1)"; then
    python manage.py seed_learning_data
fi

exec "$@"
