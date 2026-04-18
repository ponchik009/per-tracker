#!/usr/bin/env sh
set -eu

if [ -z "${GHCR_IMAGE:-}" ] || [ -z "${IMAGE_TAG:-}" ]; then
  echo "GHCR_IMAGE and IMAGE_TAG must be set"
  exit 1
fi

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
