#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
STAMP="$(date +%s)"
PROJECT_KEY="I${STAMP: -7}"
WEBHOOK_PORT="${WEBHOOK_PORT:-$((18000 + RANDOM % 20000))}"
CAPTURE="/tmp/tms-webhook-capture-$STAMP.jsonl"
TMP_DIR="/tmp/tms-integrations-$STAMP"
mkdir -p "$TMP_DIR"

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

pretty_file() {
  local file="$1"
  if [ ! -s "$file" ]; then
    echo "(empty body)"
    return 0
  fi
  python3 -m json.tool "$file" 2>/dev/null || cat "$file"
}

assert_success_file() {
  local file="$1" label="$2"
  python3 - "$file" "$label" <<'PY'
import json, sys
from pathlib import Path
file = Path(sys.argv[1])
label = sys.argv[2]
j = json.loads(file.read_text())
assert j.get('success') is True, j
print(f'{label}=true')
PY
}

json_value_file() {
  local file="$1" expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
expr = sys.argv[2]

def walk(obj, path):
    cur = obj
    for part in path.split('.'):
        if part.endswith(']'):
            name, idx = part[:-1].split('[')
            cur = cur[name][int(idx)]
        else:
            cur = cur[part]
    return cur
print(walk(j, expr))
PY
}

post_json_file() {
  local path="$1" body="$2" out="$3" token="${4:-$TOKEN}"
  curl -sS -X POST "$BASE_URL$path" \
    -H 'Content-Type: application/json' \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token" \
    -d "$body" > "$out"
}

patch_json_file() {
  local path="$1" body="$2" out="$3" token="${4:-$TOKEN}"
  curl -sS -X PATCH "$BASE_URL$path" \
    -H 'Content-Type: application/json' \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token" \
    -d "$body" > "$out"
}

get_json_file() {
  local path="$1" out="$2" token="${3:-$TOKEN}"
  curl -sS "$BASE_URL$path" \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token" > "$out"
}

login_token() {
  local login_email="${1:-admin@acme.com}"
  local login_pass="${2:-Test@1234}"
  local safe_email="${login_email//@/-}"
  local out="$TMP_DIR/login-${safe_email}.json"

  curl -sS -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -d "{\"email\":\"$login_email\",\"password\":\"$login_pass\"}" > "$out"

  python3 - "$out" <<'PYJSON'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
j = json.loads(path.read_text())

if j.get("success") is not True:
    print(json.dumps(j, indent=2), file=sys.stderr)
    raise SystemExit("login failed")

print(j["data"]["tokens"]["accessToken"])
PYJSON
}

TOKEN="$(login_token admin@acme.com)"
DEV1_TOKEN="$(login_token dev1@acme.com)"

node - "$WEBHOOK_PORT" "$CAPTURE" <<'NODE' &
const http = require('http');
const fs = require('fs');
const port = Number(process.argv[2]);
const file = process.argv[3];
http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    fs.appendFileSync(file, JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body, at: new Date().toISOString() }) + '\n');
    res.statusCode = 204;
    res.end();
  });
}).listen(port, '127.0.0.1', () => console.log(`webhook-capture:${port}`));
NODE
SERVER_PID=$!
sleep 1

echo "UC-45 to UC-48 setup project"
PROJECT_FILE="$TMP_DIR/project.json"
post_json_file /projects "{\"name\":\"Integration Smoke $STAMP\",\"key\":\"$PROJECT_KEY\",\"description\":\"Integration smoke project\"}" "$PROJECT_FILE"
pretty_file "$PROJECT_FILE"
assert_success_file "$PROJECT_FILE" project_create
PROJECT_ID="$(json_value_file "$PROJECT_FILE" data.id)"

post_json_file "/projects/$PROJECT_ID/invite" '{"email":"dev1@acme.com","role":"MEMBER"}' "$TMP_DIR/invite-dev1.json"

echo "UC-46 configure notification preferences"
PREF_FILE="$TMP_DIR/preferences.json"
patch_json_file /notifications/preferences '{"prefs":[{"eventType":"ISSUE_ASSIGNED","inApp":true,"email":true},{"eventType":"ISSUE_UPDATED","inApp":true,"email":true},{"eventType":"ISSUE_MENTIONED","inApp":true,"email":true}]}' "$PREF_FILE" "$DEV1_TOKEN"
pretty_file "$PREF_FILE"
python3 - "$PREF_FILE" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
assert j.get('success') is True, j
assert any(p.get('eventType') == 'ISSUE_ASSIGNED' and p.get('email') is True for p in j.get('data', [])), j
print('notification_preferences=true')
PY

MEMBERS_FILE="$TMP_DIR/members.json"
get_json_file "/projects/$PROJECT_ID/members" "$MEMBERS_FILE"
ASSIGNEE_ID="$(python3 - "$MEMBERS_FILE" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
print([m for m in j['data'] if m['user']['email'] == 'dev1@acme.com'][0]['user']['id'])
PY
)"

echo "UC-45 receive email notification through queue"
ISSUE_FILE="$TMP_DIR/issue.json"
post_json_file "/projects/$PROJECT_ID/issues" "{\"title\":\"Integration notification issue $STAMP\",\"description\":\"Email notification smoke\",\"assigneeId\":\"$ASSIGNEE_ID\",\"priority\":\"HIGH\"}" "$ISSUE_FILE"
pretty_file "$ISSUE_FILE"
assert_success_file "$ISSUE_FILE" issue_create
ISSUE_ID="$(json_value_file "$ISSUE_FILE" data.id)"
ISSUE_KEY="$(json_value_file "$ISSUE_FILE" data.key)"

echo "Waiting for email worker audit log"

EMAIL_AUDIT_FOUND=0

for attempt in $(seq 1 30); do
  EMAIL_AUDIT_COUNT="$(
    timeout 5s docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform \
      -v issue_id="${ISSUE_ID:-}" \
      -v issue_key="${ISSUE_KEY:-}" \
      -At <<'SQL'
SELECT count(*)
FROM "AuditLog"
WHERE action = 'email.notification.sent'
  AND "createdAt" >= now() - interval '15 minutes'
  AND (
    :'issue_id' = ''
    OR "entityId" = :'issue_id'
    OR "newData"->>'entityId' = :'issue_id'
    OR "newData"->>'title' ILIKE '%' || :'issue_key' || '%'
    OR ("entityType" = 'issue' AND "newData"->>'type' = 'ISSUE_ASSIGNED')
  );
SQL
  )"

  EMAIL_AUDIT_COUNT="${EMAIL_AUDIT_COUNT:-0}"
  echo "email_audit_check_attempt=$attempt count=$EMAIL_AUDIT_COUNT"

  if [ "$EMAIL_AUDIT_COUNT" != "0" ]; then
    EMAIL_AUDIT_FOUND=1
    break
  fi

  sleep 1
done

if [ "$EMAIL_AUDIT_FOUND" != "1" ]; then
  echo "ERROR: email notification audit not found after 30 seconds" >&2
  echo "--- Recent email audit rows ---" >&2
  docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform <<'SQL' >&2
SELECT
  action,
  "entityType",
  "entityId",
  "newData"->>'title' AS title,
  "newData"->>'type' AS type,
  "createdAt"
FROM "AuditLog"
WHERE action = 'email.notification.sent'
ORDER BY "createdAt" DESC
LIMIT 10;
SQL

  echo "--- Recent API logs ---" >&2
  journalctl -u pm-platform-api -n 120 --no-pager | grep -Ei "email|worker|queue|audit|redis|error" || true
  exit 1
fi

echo "email_notification=true"
echo "UC-47 configure webhook and test delivery"
WEBHOOK_FILE="$TMP_DIR/webhook.json"
post_json_file "/projects/$PROJECT_ID/webhooks" "{\"url\":\"http://127.0.0.1:$WEBHOOK_PORT/hook\",\"events\":[\"webhook.test\",\"issue.updated\",\"github.commit.linked\"],\"secret\":\"smoke-secret-$STAMP\",\"isActive\":true}" "$WEBHOOK_FILE"
pretty_file "$WEBHOOK_FILE"
assert_success_file "$WEBHOOK_FILE" webhook_create
WEBHOOK_ID="$(json_value_file "$WEBHOOK_FILE" data.id)"
post_json_file "/projects/$PROJECT_ID/webhooks/$WEBHOOK_ID/test" '{}' "$TMP_DIR/webhook-test.json"
for i in {1..30}; do
  if [ -s "$CAPTURE" ]; then break; fi
  sleep 1
done
[ -s "$CAPTURE" ] || { echo "webhook capture did not receive request" >&2; exit 1; }
echo "webhook_delivery=true"
DELIVERIES_FILE="$TMP_DIR/deliveries.json"
get_json_file "/projects/$PROJECT_ID/webhooks/$WEBHOOK_ID/deliveries" "$DELIVERIES_FILE"
python3 - "$DELIVERIES_FILE" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
assert j.get('success') is True, j
assert len(j.get('data', [])) >= 1, j
print('webhook_delivery_list=true')
PY

echo "UC-48 link GitHub commit"
COMMIT_FILE="$TMP_DIR/commit.json"
post_json_file "/projects/$PROJECT_ID/github/commits" "{\"sha\":\"abc123def4567890\",\"message\":\"Implement integration for $ISSUE_KEY\",\"url\":\"https://github.com/praiseable/TicketingManagementSystem/commit/abc123def4567890\",\"author\":\"Smoke Bot\",\"repo\":\"praiseable/TicketingManagementSystem\"}" "$COMMIT_FILE"
pretty_file "$COMMIT_FILE"
python3 - "$COMMIT_FILE" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
assert j.get('success') is True, j
assert j.get('data', {}).get('count', 0) >= 1, j
print('github_commit_link=true')
PY
COMMITS_FILE="$TMP_DIR/commits-list.json"
get_json_file "/projects/$PROJECT_ID/github/issues/$ISSUE_ID/commits" "$COMMITS_FILE"
python3 - "$COMMITS_FILE" <<'PY'
import json, sys
from pathlib import Path
j = json.loads(Path(sys.argv[1]).read_text())
assert j.get('success') is True, j
assert any(c.get('sha') == 'abc123def4567890' for c in j.get('data', [])), j
print('github_commit_list=true')
PY

echo "UC-45 to UC-48 integration smoke test passed"
