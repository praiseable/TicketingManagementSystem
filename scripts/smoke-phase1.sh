#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
EMAIL="${EMAIL:-admin@acme.com}"
PASSWORD="${PASSWORD:-Test@1234}"

printf 'Health through %s\n' "$BASE_URL"
curl -fsS -H "Host: $HOST_HEADER" "$BASE_URL/api/health" | python3 -m json.tool

TOKEN="$(curl -fsS -X POST "$BASE_URL/api/auth/login" \
  -H "Host: $HOST_HEADER" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')"

printf '\nProjects\n'
curl -fsS -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/projects" | python3 -m json.tool | head -120

PROJECT_ID="$(curl -fsS -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/projects" | python3 -c 'import sys,json; data=json.load(sys.stdin)["data"]; print(data[0]["id"])')"
printf '\nIssue count for project %s\n' "$PROJECT_ID"
curl -fsS -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/projects/$PROJECT_ID/issues?page=1&limit=500" \
  | python3 -c 'import sys,json; j=json.load(sys.stdin); print("success=", j.get("success")); print("count=", len(j.get("data") or [])); print("meta=", j.get("meta")); print("error=", j.get("error"))'
