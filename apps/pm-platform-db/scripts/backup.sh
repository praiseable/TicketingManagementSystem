#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source .env

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="pmplatform-${STAMP}.dump"

PGPASSWORD="${POSTGRES_PASSWORD:-pmpassword}" pg_dump \
  --host localhost \
  --port 5432 \
  --username "${POSTGRES_USER:-pmuser}" \
  --dbname "${POSTGRES_DB:-pmplatform}" \
  --format custom \
  --file "/tmp/${BACKUP}"

docker run --rm --network host -v /tmp:/backup minio/mc:latest \
  sh -c "mc alias set local http://${MINIO_ENDPOINT:-localhost}:${MINIO_PORT:-9000} ${MINIO_ACCESS_KEY:-minioadmin} ${MINIO_SECRET_KEY:-minioadmin} && mc cp /backup/${BACKUP} local/${MINIO_BUCKET_EXPORTS:-exports}/db-backups/${BACKUP}"

echo "Uploaded backup to MinIO: ${BACKUP}"
