#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
EMAIL="${EMAIL:-admin@acme.com}"
PASS="${PASS:-Test@1234}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

post_json() {
  local path="$1" body="$2" out="$3" token="${4:-$TOKEN}"
  curl -sS -o "$out" -w "%{http_code}" -X POST "$BASE_URL$path" \
    -H 'Content-Type: application/json' \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token" \
    -d "$body"
}

patch_json() {
  local path="$1" body="$2" out="$3" token="${4:-$TOKEN}"
  curl -sS -o "$out" -w "%{http_code}" -X PATCH "$BASE_URL$path" \
    -H 'Content-Type: application/json' \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token" \
    -d "$body"
}

get_json() {
  local path="$1" out="$2" token="${3:-$TOKEN}"
  curl -sS -o "$out" -w "%{http_code}" -X GET "$BASE_URL$path" \
    -H "Host: $HOST_HEADER" \
    -H "Origin: $ORIGIN" \
    -H "Authorization: Bearer $token"
}

pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
assert_success() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); label=sys.argv[2]
assert j.get('success') is True, j
print(f'{label}=true')
PY
}
extract() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); expr=sys.argv[2]
cur=j
for part in expr.split('.'):
    if part.isdigit(): cur=cur[int(part)]
    else: cur=cur.get(part)
print(cur if cur is not None else '')
PY
}

LOGIN_CODE="$(curl -sS -o "$TMP/login.json" -w "%{http_code}" -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
[ "$LOGIN_CODE" = "200" ] || { echo "Login failed HTTP $LOGIN_CODE"; pretty "$TMP/login.json"; exit 1; }
TOKEN="$(extract "$TMP/login.json" data.tokens.accessToken)"

echo "UC-30 to UC-34 setup project"
PROJECT_KEY="B${STAMP: -7}"
CREATE_PROJECT_CODE="$(post_json /projects "{\"name\":\"Board Metrics $STAMP\",\"key\":\"$PROJECT_KEY\",\"description\":\"UC30-34 smoke project\"}" "$TMP/project.json")"
[ "$CREATE_PROJECT_CODE" = "201" ] || { echo "Project create failed HTTP $CREATE_PROJECT_CODE"; pretty "$TMP/project.json"; exit 1; }
assert_success "$TMP/project.json" project_create
PROJECT_ID="$(extract "$TMP/project.json" data.id)"

WF_CODE="$(get_json "/projects/$PROJECT_ID/workflows" "$TMP/workflows.json")"
[ "$WF_CODE" = "200" ] || { echo "Workflow list failed HTTP $WF_CODE"; pretty "$TMP/workflows.json"; exit 1; }
WF_ID="$(python3 - <<PY
import json
j=json.load(open('$TMP/workflows.json'))
print(j['data'][0]['id'])
PY
)"
BACKLOG_ID="$(python3 - <<PY
import json
j=json.load(open('$TMP/workflows.json'))
statuses=j['data'][0]['statuses']
print(next(s['id'] for s in statuses if s['name']=='Backlog'))
PY
)"
PROGRESS_ID="$(python3 - <<PY
import json
j=json.load(open('$TMP/workflows.json'))
statuses=j['data'][0]['statuses']
print(next(s['id'] for s in statuses if s['name']=='In Progress'))
PY
)"
DONE_ID="$(python3 - <<PY
import json
j=json.load(open('$TMP/workflows.json'))
statuses=j['data'][0]['statuses']
print(next(s['id'] for s in statuses if s['name']=='Done'))
PY
)"
TYPE_ID="$(python3 - <<PY
import json
j=json.load(open('$TMP/project.json'))
# project create response does not include issue types, fetch separately in next block
print('')
PY
)"
TYPES_CODE="$(get_json "/projects/$PROJECT_ID/issue-types" "$TMP/types.json")"
[ "$TYPES_CODE" = "200" ] || { echo "Issue types failed HTTP $TYPES_CODE"; pretty "$TMP/types.json"; exit 1; }
TYPE_ID="$(extract "$TMP/types.json" data.0.id)"
MEMBERS_CODE="$(get_json "/projects/$PROJECT_ID/members" "$TMP/members.json")"
[ "$MEMBERS_CODE" = "200" ] || { echo "Members failed HTTP $MEMBERS_CODE"; pretty "$TMP/members.json"; exit 1; }
ADMIN_ID="$(extract "$TMP/members.json" data.0.user.id)"

create_issue() {
  local title="$1" priority="$2" labels="$3" points="$4" assignee="$5" out="$6"
  local body="{\"title\":\"$title\",\"description\":\"UC30-34 smoke\",\"issueTypeId\":\"$TYPE_ID\",\"workflowStatusId\":\"$BACKLOG_ID\",\"priority\":\"$priority\",\"labels\":\"$labels\",\"storyPoints\":$points,\"assigneeId\":\"$assignee\"}"
  local code="$(post_json "/projects/$PROJECT_ID/issues" "$body" "$out")"
  [ "$code" = "201" ] || { echo "Issue create failed HTTP $code"; pretty "$out"; exit 1; }
}

create_issue "UC30 Alpha $STAMP" HIGH "alpha,board" 2 "$ADMIN_ID" "$TMP/issue1.json"
create_issue "UC30 Beta $STAMP" MEDIUM "beta,board" 3 "$ADMIN_ID" "$TMP/issue2.json"
create_issue "UC30 Gamma $STAMP" LOW "gamma" 5 "$ADMIN_ID" "$TMP/issue3.json"
I1="$(extract "$TMP/issue1.json" data.id)"
I2="$(extract "$TMP/issue2.json" data.id)"
I3="$(extract "$TMP/issue3.json" data.id)"

# UC-30: estimate story points by updating an issue.
echo "UC-30 estimate story points"
PATCH_CODE="$(patch_json "/projects/$PROJECT_ID/issues/$I1" "{\"storyPoints\":8}" "$TMP/story-update.json")"
[ "$PATCH_CODE" = "200" ] || { echo "Story points update failed HTTP $PATCH_CODE"; pretty "$TMP/story-update.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/story-update.json'))
assert j['success'] is True, j
assert j['data']['storyPoints'] == 8, j['data'].get('storyPoints')
print('story_points_update=true')
PY
HIST_CODE="$(get_json "/projects/$PROJECT_ID/issues/$I1/history" "$TMP/history.json")"
[ "$HIST_CODE" = "200" ] || { echo "History failed HTTP $HIST_CODE"; pretty "$TMP/history.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/history.json'))
assert any(row.get('field') == 'storyPoints' for row in j['data']), j['data']
print('story_points_history=true')
PY

# UC-33: set WIP limit on existing In Progress status.
echo "UC-33 set WIP limit"
WIP_CODE="$(patch_json "/projects/$PROJECT_ID/workflows/$WF_ID/statuses/$PROGRESS_ID" "{\"wipLimit\":1}" "$TMP/wip.json")"
[ "$WIP_CODE" = "200" ] || { echo "WIP update failed HTTP $WIP_CODE"; pretty "$TMP/wip.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/wip.json'))
assert j['success'] is True, j
assert j['data']['wipLimit'] == 1, j
print('wip_limit_update=true')
PY

# Prepare sprint and move issues into sprint.
echo "UC-31/UC-32 prepare sprint reporting"
START="2026-07-01T00:00:00.000Z"
END="2026-07-15T23:59:59.000Z"
SPRINT_CODE="$(post_json "/projects/$PROJECT_ID/sprints" "{\"name\":\"Metrics Sprint $STAMP\",\"goal\":\"Story point reporting\",\"capacity\":16,\"startDate\":\"$START\",\"endDate\":\"$END\"}" "$TMP/sprint.json")"
[ "$SPRINT_CODE" = "201" ] || { echo "Sprint create failed HTTP $SPRINT_CODE"; pretty "$TMP/sprint.json"; exit 1; }
SPRINT_ID="$(extract "$TMP/sprint.json" data.id)"
MOVE_CODE="$(post_json "/projects/$PROJECT_ID/backlog/move-to-sprint" "{\"issueIds\":[\"$I1\",\"$I2\",\"$I3\"],\"sprintId\":\"$SPRINT_ID\"}" "$TMP/move.json")"
[ "$MOVE_CODE" = "204" ] || { echo "Move to sprint failed HTTP $MOVE_CODE"; pretty "$TMP/move.json"; exit 1; }
START_CODE="$(post_json "/projects/$PROJECT_ID/sprints/$SPRINT_ID/start" "{}" "$TMP/start.json")"
[ "$START_CODE" = "200" ] || { echo "Sprint start failed HTTP $START_CODE"; pretty "$TMP/start.json"; exit 1; }

# Move two issues into In Progress to validate WIP breach data and then one Done to support burndown.
post_json "/projects/$PROJECT_ID/issues/$I1/transition" "{\"toStatusId\":\"$PROGRESS_ID\",\"comment\":\"UC33 WIP check\"}" "$TMP/progress1.json" >/dev/null
post_json "/projects/$PROJECT_ID/issues/$I2/transition" "{\"toStatusId\":\"$PROGRESS_ID\",\"comment\":\"UC33 WIP check\"}" "$TMP/progress2.json" >/dev/null
DONE_CODE="$(post_json "/projects/$PROJECT_ID/issues/$I1/transition" "{\"toStatusId\":\"$DONE_ID\",\"comment\":\"UC31 burndown completion\"}" "$TMP/done.json")"
[ "$DONE_CODE" = "200" ] || { echo "Issue done failed HTTP $DONE_CODE"; pretty "$TMP/done.json"; exit 1; }

# UC-31: burndown.
echo "UC-31 view burndown chart data"
BURN_CODE="$(get_json "/projects/$PROJECT_ID/sprints/$SPRINT_ID/burndown" "$TMP/burndown.json")"
[ "$BURN_CODE" = "200" ] || { echo "Burndown failed HTTP $BURN_CODE"; pretty "$TMP/burndown.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/burndown.json'))
assert j['success'] is True and len(j['data']) > 0, j
assert 'remaining' in j['data'][0] and 'ideal' in j['data'][0], j['data'][0]
print('burndown_data=true')
PY

# Complete sprint to make velocity meaningful.
COMPLETE_CODE="$(post_json "/projects/$PROJECT_ID/sprints/$SPRINT_ID/complete" "{\"moveToSprintId\":null}" "$TMP/complete.json")"
[ "$COMPLETE_CODE" = "200" ] || { echo "Sprint complete failed HTTP $COMPLETE_CODE"; pretty "$TMP/complete.json"; exit 1; }

# UC-32: velocity.
echo "UC-32 view velocity report"
VEL_CODE="$(get_json "/projects/$PROJECT_ID/sprints/velocity" "$TMP/velocity.json")"
[ "$VEL_CODE" = "200" ] || { echo "Velocity failed HTTP $VEL_CODE"; pretty "$TMP/velocity.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/velocity.json'))
assert j['success'] is True and len(j['data']) >= 1, j
row=j['data'][-1]
assert row['committed'] >= 16, row
assert row['completed'] >= 8, row
print('velocity_data=true')
PY

# UC-34: swimlanes by assignee, priority, label and status.
echo "UC-34 view board swimlanes"
for group in assignee priority label status; do
  code="$(get_json "/projects/$PROJECT_ID/issues/swimlanes/summary?groupBy=$group" "$TMP/swimlane-$group.json")"
  [ "$code" = "200" ] || { echo "Swimlane $group failed HTTP $code"; pretty "$TMP/swimlane-$group.json"; exit 1; }
  python3 - <<PY
import json
j=json.load(open('$TMP/swimlane-$group.json'))
assert j['success'] is True, j
assert j['data']['groupBy'] == '$group', j
assert len(j['data']['groups']) >= 1, j['data']
print('swimlane_${group}=true')
PY
done

# WIP summary check: In Progress should now have at least one active issue and WIP limit should be stored.
WF2_CODE="$(get_json "/projects/$PROJECT_ID/workflows" "$TMP/workflows-after.json")"
[ "$WF2_CODE" = "200" ] || { echo "Workflow reload failed HTTP $WF2_CODE"; pretty "$TMP/workflows-after.json"; exit 1; }
python3 - <<PY
import json
j=json.load(open('$TMP/workflows-after.json'))
statuses=[s for wf in j['data'] for s in wf.get('statuses', [])]
st=next(s for s in statuses if s['id']=='$PROGRESS_ID')
assert st.get('wipLimit') == 1, st
print('wip_limit_persisted=true')
PY

echo "UC-30 to UC-34 story/reporting/board smoke test passed"
