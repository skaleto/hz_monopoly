#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Set PUBLIC_BASE_URL and APP_SECRET before public deployment." >&2
  exit 1
fi

docker compose up -d --build
docker compose ps
