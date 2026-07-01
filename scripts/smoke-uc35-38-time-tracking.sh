#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" auth="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  if [ -n "$auth" ]; then args+=(-H "Authorization: Bearer $auth"); fi
  if [ "$method" != "GET" ] && [ "$method" != "DELETE" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
  curl "${args[@]}"
}

pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
assert_success() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); label=sys.argv[2]
assert j.get('success') is True, j
print(f'{label}=true')
PY
}
json_val() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); path=sys.argv[2].split('.')
v=j
for p in path:
    if p.isdigit(): v=v[int(p)]
    else: v=v.get(p)
print('' if v is None else v)
PY
}

KEY="T$((STAMP % 100000000))"
EMAIL="admin@acme.com"
PASS="Test@1234"

LOGIN_CODE=$(curl_json POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$TMP/login.json")
[ "$LOGIN_CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }
TOKEN=$(json_val "$TMP/login.json" data.tokens.accessToken)
ADMIN_ID=$(json_val "$TMP/login.json" data.user.id)

echo "UC-35 to UC-38 setup project"
PROJECT_CODE=$(curl_json POST /projects "{\"name\":\"Time Tracking $STAMP\",\"key\":\"$KEY\",\"description\":\"Smoke project for time tracking\"}" "$TMP/project.json" "$TOKEN")
[ "$PROJECT_CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }
assert_success "$TMP/project.json" project_create
PROJECT_ID=$(json_val "$TMP/project.json" data.id)

ISSUE_BODY="{\"title\":\"Time tracking issue $STAMP\",\"description\":\"Manual worklog and live timer test\",\"priority\":\"HIGH\",\"assigneeId\":\"$ADMIN_ID\",\"storyPoints\":5,\"originalEstimate\":7200,\"remainingEstimate\":7200}"
ISSUE_CODE=$(curl_json POST "/projects/$PROJECT_ID/issues" "$ISSUE_BODY" "$TMP/issue.json" "$TOKEN")
[ "$ISSUE_CODE" = "201" ] || { pretty "$TMP/issue.json"; exit 1; }
assert_success "$TMP/issue.json" issue_create
ISSUE_ID=$(json_val "$TMP/issue.json" data.id)

echo "UC-35 log work on issue"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WORKLOG_CODE=$(curl_json POST "/issues/$ISSUE_ID/worklogs" "{\"timeSpent\":1800,\"dateStarted\":\"$NOW\",\"description\":\"Manual smoke worklog\"}" "$TMP/worklog.json" "$TOKEN")
[ "$WORKLOG_CODE" = "201" ] || { pretty "$TMP/worklog.json"; exit 1; }
pretty "$TMP/worklog.json"
assert_success "$TMP/worklog.json" worklog_create
WORKLOG_ID=$(json_val "$TMP/worklog.json" data.id)

DETAIL_CODE=$(curl_json GET "/projects/$PROJECT_ID/issues/$ISSUE_ID" "" "$TMP/detail-after-log.json" "$TOKEN")
[ "$DETAIL_CODE" = "200" ] || { pretty "$TMP/detail-after-log.json"; exit 1; }
python3 - "$TMP/detail-after-log.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); issue=j['data']
assert issue['remainingEstimate'] == 5400, issue.get('remainingEstimate')
assert any(h['field']=='worklog.added' for h in issue.get('histories', [])), [h.get('field') for h in issue.get('histories', [])]
print('remaining_after_manual_log=true')
print('worklog_history_added=true')
PY

echo "UC-38 edit worklog"
PATCH_CODE=$(curl_json PATCH "/issues/$ISSUE_ID/worklogs/$WORKLOG_ID" "{\"timeSpent\":2400,\"dateStarted\":\"$NOW\",\"description\":\"Edited smoke worklog\"}" "$TMP/worklog-edit.json" "$TOKEN")
[ "$PATCH_CODE" = "200" ] || { pretty "$TMP/worklog-edit.json"; exit 1; }
assert_success "$TMP/worklog-edit.json" worklog_edit
DETAIL_CODE=$(curl_json GET "/projects/$PROJECT_ID/issues/$ISSUE_ID" "" "$TMP/detail-after-edit.json" "$TOKEN")
[ "$DETAIL_CODE" = "200" ] || { pretty "$TMP/detail-after-edit.json"; exit 1; }
python3 - "$TMP/detail-after-edit.json" <<'PY'
import json, sys
issue=json.load(open(sys.argv[1]))['data']
assert issue['remainingEstimate'] == 4800, issue.get('remainingEstimate')
assert any(h['field']=='worklog.updated' for h in issue.get('histories', [])), [h.get('field') for h in issue.get('histories', [])]
print('remaining_after_worklog_edit=true')
print('worklog_history_updated=true')
PY

echo "UC-36 start live timer"
START_CODE=$(curl_json POST /timers/start "{\"issueId\":\"$ISSUE_ID\"}" "$TMP/timer-start.json" "$TOKEN")
[ "$START_CODE" = "201" ] || { pretty "$TMP/timer-start.json"; exit 1; }
pretty "$TMP/timer-start.json"
assert_success "$TMP/timer-start.json" timer_start
sleep 2

ACTIVE_CODE=$(curl_json GET /timers/active "" "$TMP/timer-active.json" "$TOKEN")
[ "$ACTIVE_CODE" = "200" ] || { pretty "$TMP/timer-active.json"; exit 1; }
python3 - "$TMP/timer-active.json" "$ISSUE_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); issue_id=sys.argv[2]
rows=j.get('data') or []
assert any(r.get('issueId') == issue_id and r.get('status') == 'ACTIVE' for r in rows), rows
print('active_timer_list=true')
PY

echo "UC-36 pause live timer"
PAUSE_CODE=$(curl_json POST /timers/pause "{\"issueId\":\"$ISSUE_ID\"}" "$TMP/timer-pause.json" "$TOKEN")
[ "$PAUSE_CODE" = "200" ] || { pretty "$TMP/timer-pause.json"; exit 1; }
assert_success "$TMP/timer-pause.json" timer_pause

echo "UC-36 resume live timer"
RESUME_CODE=$(curl_json POST /timers/start "{\"issueId\":\"$ISSUE_ID\"}" "$TMP/timer-resume.json" "$TOKEN")
[ "$RESUME_CODE" = "201" ] || { pretty "$TMP/timer-resume.json"; exit 1; }
assert_success "$TMP/timer-resume.json" timer_resume
sleep 2

echo "UC-37 stop and save timer"
STOP_CODE=$(curl_json POST /timers/stop "{\"issueId\":\"$ISSUE_ID\",\"description\":\"Stopped smoke timer\"}" "$TMP/timer-stop.json" "$TOKEN")
[ "$STOP_CODE" = "201" ] || { pretty "$TMP/timer-stop.json"; exit 1; }
pretty "$TMP/timer-stop.json"
assert_success "$TMP/timer-stop.json" timer_stop_saved
TIMER_WORKLOG_ID=$(json_val "$TMP/timer-stop.json" data.id)

ACTIVE_CODE=$(curl_json GET /timers/active "" "$TMP/timer-active-after-stop.json" "$TOKEN")
[ "$ACTIVE_CODE" = "200" ] || { pretty "$TMP/timer-active-after-stop.json"; exit 1; }
python3 - "$TMP/timer-active-after-stop.json" "$ISSUE_ID" <<'PY'
import json, sys
rows=json.load(open(sys.argv[1])).get('data') or []
assert not any(r.get('issueId') == sys.argv[2] for r in rows), rows
print('timer_removed_after_stop=true')
PY

DETAIL_CODE=$(curl_json GET "/projects/$PROJECT_ID/issues/$ISSUE_ID" "" "$TMP/detail-after-timer.json" "$TOKEN")
[ "$DETAIL_CODE" = "200" ] || { pretty "$TMP/detail-after-timer.json"; exit 1; }
python3 - "$TMP/detail-after-timer.json" <<'PY'
import json, sys
issue=json.load(open(sys.argv[1]))['data']
fields=[h['field'] for h in issue.get('histories', [])]
assert any(f == 'timer.started' for f in fields), fields
assert any(f == 'timer.paused' for f in fields), fields
assert any(f == 'timer.resumed' for f in fields), fields
assert any(f == 'timer.stopped' for f in fields), fields
assert len(issue.get('worklogs') or []) >= 2, len(issue.get('worklogs') or [])
assert issue.get('remainingEstimate') is not None and issue['remainingEstimate'] < 4800, issue.get('remainingEstimate')
print('timer_history_verified=true')
print('timer_worklog_saved=true')
print('remaining_after_timer_stop=true')
PY

echo "UC-38 delete worklog"
DELETE_CODE=$(curl_json DELETE "/issues/$ISSUE_ID/worklogs/$WORKLOG_ID" "" "$TMP/worklog-delete.json" "$TOKEN")
[ "$DELETE_CODE" = "204" ] || { echo "delete code=$DELETE_CODE"; pretty "$TMP/worklog-delete.json"; exit 1; }
DETAIL_CODE=$(curl_json GET "/projects/$PROJECT_ID/issues/$ISSUE_ID" "" "$TMP/detail-after-delete.json" "$TOKEN")
[ "$DETAIL_CODE" = "200" ] || { pretty "$TMP/detail-after-delete.json"; exit 1; }
python3 - "$TMP/detail-after-delete.json" "$WORKLOG_ID" "$TIMER_WORKLOG_ID" <<'PY'
import json, sys
issue=json.load(open(sys.argv[1]))['data']
deleted_id=sys.argv[2]; timer_id=sys.argv[3]
worklogs=issue.get('worklogs') or []
assert not any(w['id'] == deleted_id for w in worklogs), worklogs
assert any(w['id'] == timer_id for w in worklogs), worklogs
assert any(h['field']=='worklog.deleted' for h in issue.get('histories', [])), [h.get('field') for h in issue.get('histories', [])]
print('worklog_delete=true')
print('worklog_history_deleted=true')
PY

echo "UC-35 to UC-38 time tracking smoke test passed"
