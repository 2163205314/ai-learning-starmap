#!/bin/sh
set -eu

if [ -f /run/host-gitconfig ]; then
    cp /run/host-gitconfig "$HOME/.gitconfig"
    chmod 600 "$HOME/.gitconfig"
fi

if [ -d /run/host-ssh ]; then
    mkdir -p "$HOME/.ssh"
    cp -R /run/host-ssh/. "$HOME/.ssh/"
    find "$HOME/.ssh" -type d -exec chmod 700 {} \;
    find "$HOME/.ssh" -type f -exec chmod 600 {} \;
fi

git config --global --add safe.directory /app

python manage.py migrate --noinput

if ! python manage.py shell -c "from learning.models import KnowledgeCard; raise SystemExit(0 if KnowledgeCard.objects.exists() else 1)"; then
    python manage.py seed_learning_data
fi

exec "$@"
