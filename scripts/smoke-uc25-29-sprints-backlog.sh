#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
EMAIL="${EMAIL:-admin@acme.com}"
PASSWORD="${PASSWORD:-Test@1234}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

api() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  if [ "$method" != "GET" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
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
j=json.load(open(sys.argv[1])); expr=sys.argv[2]
cur=j
for part in expr.split('.'):
    if part.isdigit(): cur=cur[int(part)]
    else: cur=cur.get(part)
print(cur if cur is not None else '')
PY
}

LOGIN_CODE=$(api POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$TMP/login.json")
[ "$LOGIN_CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }
TOKEN=$(json_value "$TMP/login.json" data.tokens.accessToken)

echo "UC-25 setup project"
PROJECT_KEY="S$((STAMP % 100000000))"
PROJECT_BODY="{\"name\":\"Sprint QA $STAMP\",\"key\":\"$PROJECT_KEY\",\"description\":\"Sprint smoke project\"}"
CODE=$(api POST /projects "$PROJECT_BODY" "$TMP/project.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }
assert_success "$TMP/project.json" project_create
PROJECT_ID=$(json_value "$TMP/project.json" data.id)

CODE=$(api GET "/projects/$PROJECT_ID" "" "$TMP/project-detail.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/project-detail.json"; exit 1; }
ISSUE_TYPE_ID=$(python3 - <<PY
import json
j=json.load(open('$TMP/project-detail.json'))
print(j['data']['issueTypes'][0]['id'])
PY
)
STATUS_BACKLOG=$(python3 - <<PY
import json
j=json.load(open('$TMP/project-detail.json'))
statuses=j['data']['workflows'][0]['statuses']
print(statuses[0]['id'])
PY
)
STATUS_DONE=$(python3 - <<PY
import json
j=json.load(open('$TMP/project-detail.json'))
statuses=j['data']['workflows'][0]['statuses']
print([s for s in statuses if s['category']=='DONE'][0]['id'])
PY
)

echo "Create backlog issues"
ISSUE_IDS=()
for i in 1 2 3 4 5; do
  BODY="{\"issueTypeId\":\"$ISSUE_TYPE_ID\",\"workflowStatusId\":\"$STATUS_BACKLOG\",\"title\":\"Sprint smoke issue $i $STAMP\",\"priority\":\"MEDIUM\",\"storyPoints\":$((i+1))}"
  CODE=$(api POST "/projects/$PROJECT_ID/issues" "$BODY" "$TMP/issue-$i.json" "$TOKEN")
  [ "$CODE" = "201" ] || { pretty "$TMP/issue-$i.json"; exit 1; }
  ISSUE_IDS+=("$(json_value "$TMP/issue-$i.json" data.id)")
done

echo "UC-25 create sprint"
START=$(date -u +%Y-%m-%dT00:00:00.000Z)
END=$(date -u -d '+14 days' +%Y-%m-%dT23:59:59.000Z)
SPRINT_BODY="{\"name\":\"Sprint A $STAMP\",\"goal\":\"Deliver sprint smoke scope\",\"capacity\":20,\"startDate\":\"$START\",\"endDate\":\"$END\"}"
CODE=$(api POST "/projects/$PROJECT_ID/sprints" "$SPRINT_BODY" "$TMP/sprint-a.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/sprint-a.json"; exit 1; }
pretty "$TMP/sprint-a.json"; assert_success "$TMP/sprint-a.json" sprint_create
SPRINT_ID=$(json_value "$TMP/sprint-a.json" data.id)

NEXT_BODY="{\"name\":\"Sprint B $STAMP\",\"goal\":\"Next sprint\",\"capacity\":20,\"startDate\":\"$START\",\"endDate\":\"$END\"}"
CODE=$(api POST "/projects/$PROJECT_ID/sprints" "$NEXT_BODY" "$TMP/sprint-b.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/sprint-b.json"; exit 1; }
NEXT_SPRINT_ID=$(json_value "$TMP/sprint-b.json" data.id)

echo "UC-29 view backlog"
CODE=$(api GET "/projects/$PROJECT_ID/backlog" "" "$TMP/backlog-before.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/backlog-before.json"; exit 1; }
assert_success "$TMP/backlog-before.json" backlog_view
python3 - <<PY
import json
j=json.load(open('$TMP/backlog-before.json'))
assert len(j['data']) >= 5, len(j['data'])
print('backlog_count_before=', len(j['data']))
PY

echo "UC-27 add issues to sprint"
MOVE_BODY=$(python3 - <<PY
import json
ids=${ISSUE_IDS[@]+$(printf '%s\n' "${ISSUE_IDS[@]}" | python3 -c 'import sys,json; print(json.dumps([x.strip() for x in sys.stdin if x.strip()][:3]))')}
print(json.dumps({'issueIds': ids, 'sprintId': '$SPRINT_ID'}))
PY
)
CODE=$(api POST "/projects/$PROJECT_ID/backlog/move-to-sprint" "$MOVE_BODY" "$TMP/move.json" "$TOKEN")
[ "$CODE" = "204" ] || { pretty "$TMP/move.json"; exit 1; }
echo "move_to_sprint=true"

CODE=$(api GET "/projects/$PROJECT_ID/sprints/$SPRINT_ID" "" "$TMP/sprint-detail.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/sprint-detail.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/sprint-detail.json'))
assert len(j['data']['issues']) == 3, len(j['data']['issues'])
print('sprint_issue_count=', len(j['data']['issues']))
PY

echo "UC-26 start sprint"
CODE=$(api POST "/projects/$PROJECT_ID/sprints/$SPRINT_ID/start" "{}" "$TMP/start.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/start.json"; exit 1; }
assert_success "$TMP/start.json" sprint_start

CONFLICT_CODE=$(api POST "/projects/$PROJECT_ID/sprints/$NEXT_SPRINT_ID/start" "{}" "$TMP/start-conflict.json" "$TOKEN")
[ "$CONFLICT_CODE" = "409" ] || { echo "Expected active sprint conflict 409, got $CONFLICT_CODE"; pretty "$TMP/start-conflict.json"; exit 1; }
echo "single_active_sprint_guard=true"

echo "Mark one issue done before completing sprint"
DONE_BODY="{\"toStatusId\":\"$STATUS_DONE\",\"comment\":\"Sprint completion smoke\"}"
CODE=$(api POST "/projects/$PROJECT_ID/issues/${ISSUE_IDS[0]}/transition" "$DONE_BODY" "$TMP/done.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/done.json"; exit 1; }
assert_success "$TMP/done.json" issue_done

echo "UC-28 complete sprint and move incomplete to next sprint"
CODE=$(api POST "/projects/$PROJECT_ID/sprints/$SPRINT_ID/complete" "{\"moveToSprintId\":\"$NEXT_SPRINT_ID\"}" "$TMP/complete.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/complete.json"; exit 1; }
pretty "$TMP/complete.json"; assert_success "$TMP/complete.json" sprint_complete
python3 - <<PY
import json
j=json.load(open('$TMP/complete.json'))
assert j['data']['movedIssues'] == 2, j
assert j['data']['completedIssues'] == 1, j
print('moved_incomplete_to_next=true')
PY

CODE=$(api GET "/projects/$PROJECT_ID/sprints/$NEXT_SPRINT_ID" "" "$TMP/next-detail.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/next-detail.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/next-detail.json'))
assert len(j['data']['issues']) == 2, len(j['data']['issues'])
print('next_sprint_issue_count=', len(j['data']['issues']))
PY

CODE=$(api GET "/projects/$PROJECT_ID/sprints/$SPRINT_ID/burndown" "" "$TMP/burndown.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/burndown.json"; exit 1; }
assert_success "$TMP/burndown.json" burndown

CODE=$(api GET "/projects/$PROJECT_ID/sprints/velocity" "" "$TMP/velocity.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/velocity.json"; exit 1; }
assert_success "$TMP/velocity.json" velocity

echo "UC-25 to UC-29 sprint/backlog smoke test passed"
