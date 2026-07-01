#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
EMAIL="${EMAIL:-admin@acme.com}"
PASSWORD="${PASSWORD:-Test@1234}"
DEV_EMAIL="${DEV_EMAIL:-dev1@acme.com}"
DEV_PASSWORD="${DEV_PASSWORD:-Test@1234}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

api() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
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
json_value() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); cur=j
for part in sys.argv[2].split('.'):
    if part.isdigit(): cur=cur[int(part)]
    else: cur=cur.get(part)
print(cur if cur is not None else '')
PY
}

LOGIN_CODE=$(api POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$TMP/login.json")
[ "$LOGIN_CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }
TOKEN=$(json_value "$TMP/login.json" data.tokens.accessToken)
ADMIN_ID=$(json_value "$TMP/login.json" data.user.id)

DEV_LOGIN_CODE=$(api POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}" "$TMP/dev-login.json")
[ "$DEV_LOGIN_CODE" = "200" ] || { pretty "$TMP/dev-login.json"; exit 1; }
DEV_TOKEN=$(json_value "$TMP/dev-login.json" data.tokens.accessToken)
DEV_ID=$(json_value "$TMP/dev-login.json" data.user.id)

KEY="P$((STAMP % 100000000))"
echo "UC-39 to UC-41 setup project"
PROJECT_BODY="{\"name\":\"Performance QA $STAMP\",\"key\":\"$KEY\",\"description\":\"Performance/report smoke project\"}"
CODE=$(api POST /projects "$PROJECT_BODY" "$TMP/project.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }
assert_success "$TMP/project.json" project_create
PROJECT_ID=$(json_value "$TMP/project.json" data.id)

CODE=$(api POST "/projects/$PROJECT_ID/invite" "{\"email\":\"$DEV_EMAIL\",\"role\":\"MEMBER\"}" "$TMP/invite.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/invite.json"; exit 1; }
assert_success "$TMP/invite.json" dev_member_added

CODE=$(api GET "/projects/$PROJECT_ID" "" "$TMP/project-detail.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/project-detail.json"; exit 1; }
ISSUE_TYPE_ID=$(python3 - <<PY
import json
j=json.load(open('$TMP/project-detail.json'))
print(j['data']['issueTypes'][0]['id'])
PY
)
STATUS_DONE=$(python3 - <<PY
import json
j=json.load(open('$TMP/project-detail.json'))
statuses=j['data']['workflows'][0]['statuses']
print([s for s in statuses if s['category']=='DONE'][0]['id'])
PY
)

TODAY=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DUE=$(date -u -d '+2 days' +%Y-%m-%dT%H:%M:%SZ)

ADMIN_ISSUE_BODY="{\"issueTypeId\":\"$ISSUE_TYPE_ID\",\"title\":\"Performance admin issue $STAMP\",\"priority\":\"HIGH\",\"assigneeId\":\"$ADMIN_ID\",\"storyPoints\":8,\"originalEstimate\":7200,\"remainingEstimate\":7200,\"dueDate\":\"$DUE\"}"
CODE=$(api POST "/projects/$PROJECT_ID/issues" "$ADMIN_ISSUE_BODY" "$TMP/admin-issue.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/admin-issue.json"; exit 1; }
ADMIN_ISSUE_ID=$(json_value "$TMP/admin-issue.json" data.id)

DEV_ISSUE_BODY="{\"issueTypeId\":\"$ISSUE_TYPE_ID\",\"title\":\"Performance dev issue $STAMP\",\"priority\":\"MEDIUM\",\"assigneeId\":\"$DEV_ID\",\"storyPoints\":5,\"originalEstimate\":3600,\"remainingEstimate\":3600,\"dueDate\":\"$DUE\"}"
CODE=$(api POST "/projects/$PROJECT_ID/issues" "$DEV_ISSUE_BODY" "$TMP/dev-issue.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/dev-issue.json"; exit 1; }
DEV_ISSUE_ID=$(json_value "$TMP/dev-issue.json" data.id)

CODE=$(api POST "/projects/$PROJECT_ID/issues/$ADMIN_ISSUE_ID/transition" "{\"toStatusId\":\"$STATUS_DONE\",\"comment\":\"Performance smoke done\"}" "$TMP/admin-done.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/admin-done.json"; exit 1; }
CODE=$(api POST "/projects/$PROJECT_ID/issues/$DEV_ISSUE_ID/transition" "{\"toStatusId\":\"$STATUS_DONE\",\"comment\":\"Performance smoke done\"}" "$TMP/dev-done.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/dev-done.json"; exit 1; }

CODE=$(api POST "/issues/$ADMIN_ISSUE_ID/worklogs" "{\"timeSpent\":3600,\"dateStarted\":\"$TODAY\",\"description\":\"Admin performance smoke worklog\"}" "$TMP/admin-worklog.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/admin-worklog.json"; exit 1; }
CODE=$(api POST "/issues/$DEV_ISSUE_ID/worklogs" "{\"timeSpent\":1800,\"dateStarted\":\"$TODAY\",\"description\":\"Dev performance smoke worklog\"}" "$TMP/dev-worklog.json" "$DEV_TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/dev-worklog.json"; exit 1; }

FROM=$(date -u -d '-2 days' +%Y-%m-%d)
TO=$(date -u -d '+2 days' +%Y-%m-%d)

echo "UC-39 view individual performance dashboard"
CODE=$(api GET "/performance/me?projectId=$PROJECT_ID&period=custom&from=$FROM&to=$TO" "" "$TMP/my-performance.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/my-performance.json"; exit 1; }
pretty "$TMP/my-performance.json"
assert_success "$TMP/my-performance.json" my_performance
python3 - "$TMP/my-performance.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))['data']
s=j['summary']
assert s['issuesAssigned'] >= 1, s
assert s['issuesCompleted'] >= 1, s
assert s['timeLoggedSeconds'] >= 3600, s
assert s['storyPointsDelivered'] >= 8, s
assert isinstance(j.get('dailyTime'), list) and j['dailyTime'], j
assert isinstance(j.get('recentActivity'), list), j
print('uc39_metrics_verified=true')
PY

echo "UC-40 view team performance dashboard"
CODE=$(api GET "/performance/team?projectId=$PROJECT_ID&period=custom&from=$FROM&to=$TO" "" "$TMP/team-performance.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/team-performance.json"; exit 1; }
assert_success "$TMP/team-performance.json" team_performance
python3 - "$TMP/team-performance.json" "$ADMIN_ID" "$DEV_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))['data']
rows=j['rows']
ids={r['user']['id'] for r in rows}
assert sys.argv[2] in ids and sys.argv[3] in ids, ids
assert j['totals']['members'] >= 2, j['totals']
assert j['totals']['timeLoggedSeconds'] >= 5400, j['totals']
print('uc40_team_metrics_verified=true')
PY

echo "UC-41 view time report"
CODE=$(api GET "/performance/reports/time?projectId=$PROJECT_ID&groupBy=user&from=$FROM&to=$TO" "" "$TMP/time-report.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/time-report.json"; exit 1; }
assert_success "$TMP/time-report.json" time_report
python3 - "$TMP/time-report.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))['data']
assert j['summary']['worklogCount'] >= 2, j['summary']
assert j['summary']['timeLoggedSeconds'] >= 5400, j['summary']
assert len(j['grouped']) >= 2, j['grouped']
assert len(j['rows']) >= 2, j['rows']
print('uc41_time_report_verified=true')
PY

echo "UC-41 export time report CSV"
CSV_CODE=$(curl -sS -o "$TMP/time-report.csv" -w "%{http_code}" -X GET "$BASE_URL/performance/reports/time/export?projectId=$PROJECT_ID&groupBy=user&from=$FROM&to=$TO" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN")
[ "$CSV_CODE" = "200" ] || { echo "CSV HTTP $CSV_CODE"; cat "$TMP/time-report.csv"; exit 1; }
head -5 "$TMP/time-report.csv"
python3 - "$TMP/time-report.csv" <<'PY'
import csv, sys
rows=list(csv.DictReader(open(sys.argv[1])))
assert len(rows) >= 2, rows
assert {'user','project','issue','seconds','hours','dateStarted'}.issubset(set(rows[0].keys())), rows[0]
print('uc41_csv_export_verified=true')
PY

echo "UC-39 to UC-41 performance/report smoke test passed"
