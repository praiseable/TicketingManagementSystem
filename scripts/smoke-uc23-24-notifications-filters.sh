#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
post_json() { curl -sS -X POST "$BASE_URL$1" -H 'Content-Type: application/json' -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -d "$2"; }

login_json="$(post_json /auth/login '{"email":"admin@acme.com","password":"Test@1234"}')"
echo "$login_json" > "$TMP/login.json"
TOKEN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["tokens"]["accessToken"])' "$TMP/login.json")"
ADMIN_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["user"]["id"])' "$TMP/login.json")"

auth_get() { curl -sS "$BASE_URL$1" -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" -o "$2" -w "%{http_code}"; }
auth_patch() { curl -sS -X PATCH "$BASE_URL$1" -H 'Content-Type: application/json' -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" -d "${2:-{}}" -o "$3" -w "%{http_code}"; }
auth_patch_empty() { curl -sS -X PATCH "$BASE_URL$1" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" -o "$2" -w "%{http_code}"; }
auth_post() { curl -sS -X POST "$BASE_URL$1" -H 'Content-Type: application/json' -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" -d "$2" -o "$3" -w "%{http_code}"; }
auth_delete() { curl -sS -X DELETE "$BASE_URL$1" -H "Host: $HOST_HEADER" -H "Authorization: Bearer $TOKEN" -o "$2" -w "%{http_code}"; }

# Create a deterministic unread notification for UC-23.
docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform -v uid="$ADMIN_ID" -v stamp="$STAMP" >/dev/null <<'SQL'
INSERT INTO "Notification" (id, "userId", type, title, body, "entityType", "entityId", "isRead", "createdAt")
VALUES (gen_random_uuid(), :'uid', 'ISSUE_UPDATED', 'UC23 Smoke Notification ' || :'stamp', 'Smoke notification for UC-23 view notifications', 'smoke', :'stamp', false, now());
SQL

echo "UC-23 list unread notifications"
code="$(auth_get "/notifications?unreadOnly=true&page=1&limit=50" "$TMP/notifs.json")"
[ "$code" = "200" ] || { echo "Unexpected notification list code $code"; pretty "$TMP/notifs.json"; exit 1; }
pretty "$TMP/notifs.json"
python3 - "$TMP/notifs.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))
assert j.get('success') is True, j
assert len(j.get('data') or []) >= 1, j
print('notifications_list=true')
PY

NOTIF_ID="$(python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j["data"][0]["id"])' "$TMP/notifs.json")"

echo "UC-23 mark notification read"
code="$(auth_patch_empty "/notifications/$NOTIF_ID/read" "$TMP/read.json")"
echo "read_http_code=$code"
[ "$code" = "204" ] || { pretty "$TMP/read.json"; echo "--- recent API logs ---"; journalctl -u pm-platform-api -n 80 --no-pager || true; exit 1; }

echo "UC-23 preferences"
code="$(auth_get "/notifications/preferences" "$TMP/prefs.json")"
[ "$code" = "200" ] || { echo "Unexpected prefs code $code"; pretty "$TMP/prefs.json"; exit 1; }
pretty "$TMP/prefs.json"
python3 - "$TMP/prefs.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))
assert j.get('success') is True, j
assert len(j.get('data') or []) >= 1, j
print('notification_prefs=true')
PY

echo "UC-23 mark all read"
code="$(auth_patch_empty "/notifications/read-all" "$TMP/readall.json")"
echo "read_all_http_code=$code"
[ "$code" = "204" ] || { pretty "$TMP/readall.json"; echo "--- recent API logs ---"; journalctl -u pm-platform-api -n 100 --no-pager || true; exit 1; }

PROJECT_ID="$(auth_get /projects "$TMP/projects.json" >/dev/null; python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j["data"][-1]["id"])' "$TMP/projects.json")"
ISSUE_TYPE_ID="$(auth_get "/projects/$PROJECT_ID/issue-types" "$TMP/types.json" >/dev/null; python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j["data"][0]["id"])' "$TMP/types.json")"
STATUS_ID="$(auth_get "/projects/$PROJECT_ID/workflows" "$TMP/workflows.json" >/dev/null; python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j["data"][0]["statuses"][0]["id"])' "$TMP/workflows.json")"

echo "PROJECT_ID=$PROJECT_ID ISSUE_TYPE_ID=$ISSUE_TYPE_ID STATUS_ID=$STATUS_ID"

echo "Create UC-24 filter target issue"
body="{\"title\":\"UC24 filter issue $STAMP\",\"description\":\"Created for UC-24 filter smoke\",\"issueTypeId\":\"$ISSUE_TYPE_ID\",\"workflowStatusId\":\"$STATUS_ID\",\"priority\":\"HIGH\",\"labels\":[\"uc24-filter-$STAMP\"],\"storyPoints\":3}"
code="$(auth_post "/projects/$PROJECT_ID/issues" "$body" "$TMP/create.json")"
[ "$code" = "201" ] || { echo "Unexpected issue create code $code"; pretty "$TMP/create.json"; exit 1; }
pretty "$TMP/create.json"
python3 - "$TMP/create.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))
assert j.get('success') is True, j
print('uc24_issue_created=true')
PY

run_filter() {
  local label="$1"; shift
  local path="$1"
  echo "$label"
  code="$(auth_get "$path" "$TMP/filter.json")"
  [ "$code" = "200" ] || { echo "Unexpected filter code $code"; pretty "$TMP/filter.json"; exit 1; }
  python3 - "$TMP/filter.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))
assert j.get('success') is True, j
assert len(j.get('data') or []) >= 1, j
print('filter_result=true count=%s' % len(j.get('data') or []))
PY
}

run_filter "UC-24 filter by search" "/projects/$PROJECT_ID/issues?search=UC24%20filter%20issue%20$STAMP&limit=500"
run_filter "UC-24 filter by priority" "/projects/$PROJECT_ID/issues?priority=HIGH&limit=500"
run_filter "UC-24 filter by label" "/projects/$PROJECT_ID/issues?label=uc24-filter-$STAMP&limit=500"
run_filter "UC-24 filter by status" "/projects/$PROJECT_ID/issues?status=$STATUS_ID&limit=500"
run_filter "UC-24 filter by type" "/projects/$PROJECT_ID/issues?type=$ISSUE_TYPE_ID&limit=500"
run_filter "UC-24 filter by created date" "/projects/$PROJECT_ID/issues?createdFrom=2026-01-01&createdTo=2030-01-01&limit=500"

echo "UC-24 save filter"
filter_body="{\"name\":\"UC24 Smoke Filter $STAMP\",\"projectId\":\"$PROJECT_ID\",\"filters\":{\"priority\":\"HIGH\",\"label\":\"uc24-filter-$STAMP\"}}"
code="$(auth_post "/search/filters/save" "$filter_body" "$TMP/save-filter.json")"
[ "$code" = "201" ] || { echo "Unexpected save filter code $code"; pretty "$TMP/save-filter.json"; exit 1; }
pretty "$TMP/save-filter.json"
FILTER_ID="$(python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j["data"]["id"])' "$TMP/save-filter.json")"

echo "UC-24 list saved filters"
code="$(auth_get "/search/filters?projectId=$PROJECT_ID" "$TMP/saved-filters.json")"
[ "$code" = "200" ] || { echo "Unexpected saved filters code $code"; pretty "$TMP/saved-filters.json"; exit 1; }
pretty "$TMP/saved-filters.json"
python3 - "$TMP/saved-filters.json" "$FILTER_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); fid=sys.argv[2]
assert j.get('success') is True, j
assert any(x['id']==fid for x in j.get('data') or []), j
print('saved_filter_list=true')
PY

echo "UC-24 delete saved filter"
code="$(auth_delete "/search/filters/$FILTER_ID" "$TMP/delete-filter.json")"
echo "delete_filter_http_code=$code"
[ "$code" = "204" ] || { pretty "$TMP/delete-filter.json"; exit 1; }

echo

echo "UC-23 to UC-24 notifications/filter smoke test passed"
