#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source .env

MONTH=${1:-$(date -u +%Y_%m)}
START=${2:-$(date -u +%Y-%m-01)}
END=${3:-$(date -u -d "$START +1 month" +%Y-%m-01)}

PSQL="psql ${DATABASE_DIRECT_URL}"

$PSQL <<SQL
CREATE TABLE IF NOT EXISTS "Worklog_${MONTH}" PARTITION OF "Worklog"
FOR VALUES FROM ('${START}') TO ('${END}');

CREATE INDEX IF NOT EXISTS "Worklog_${MONTH}_issue_user_idx" ON "Worklog_${MONTH}" ("issueId", "userId");
CREATE INDEX IF NOT EXISTS "Worklog_${MONTH}_user_date_idx" ON "Worklog_${MONTH}" ("userId", "dateStarted");
CREATE INDEX IF NOT EXISTS "Worklog_${MONTH}_issue_date_idx" ON "Worklog_${MONTH}" ("issueId", "dateStarted");
SQL

echo "Partition ensured for ${MONTH}."
