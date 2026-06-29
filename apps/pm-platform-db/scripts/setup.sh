#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
fi

docker compose --env-file .env -f docker/docker-compose.yml up -d
pnpm install
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm seed
pnpm build
pnpm tsx -e "import('./src/meilisearch.ts').then(m => m.bootstrapMeilisearch())"
pnpm tsx -e "import('./src/minio.ts').then(m => m.bootstrapBuckets())"

echo "Database project ready."
