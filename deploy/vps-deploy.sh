#!/usr/bin/env sh
set -eu

if [ -z "${GHCR_IMAGE:-}" ] || [ -z "${IMAGE_TAG:-}" ]; then
  echo "GHCR_IMAGE and IMAGE_TAG must be set"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
