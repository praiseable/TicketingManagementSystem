#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@acme.com}"
ADMIN_PASS="${ADMIN_PASS:-Test@1234}"
DEV1_EMAIL="${DEV1_EMAIL:-dev1@acme.com}"
DEV1_PASS="${DEV1_PASS:-Test@1234}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() { [ -s "$1" ] && python3 -m json.tool "$1" 2>/dev/null || cat "$1" 2>/dev/null || true; }

curl_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  if [ "$method" != "GET" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
  curl "${args[@]}"
}

assert_code() { case "$1" in 200|201|204|400|401|403|404|422) return 0;; *) echo "Unexpected HTTP code for $2: $1" >&2; exit 1;; esac; }
assert_success() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]));
if j.get('success') is not True: raise SystemExit(f"{sys.argv[2]} expected success=true got {j}")
print(f"{sys.argv[2]}=true")
PY
}
extract() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); expr=sys.argv[2]
cur=j
for part in expr.split('.'):
  if part.isdigit(): cur=cur[int(part)]
  else: cur=cur.get(part)
  if cur is None: break
print(cur or '')
PY
}

json_query() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); code=sys.argv[2]
print(eval(code, {}, {'j': j}))
PY
}

echo "UC-08 to UC-16 health"
code=$(curl_json GET /health '' "$TMP/health.json"); assert_code "$code" health; pretty "$TMP/health.json"; assert_success "$TMP/health.json" health

echo "Login as $ADMIN_EMAIL"
code=$(curl_json POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" "$TMP/login.json"); assert_code "$code" login; pretty "$TMP/login.json"; assert_success "$TMP/login.json" login
TOKEN=$(extract "$TMP/login.json" data.tokens.accessToken)

code=$(curl_json GET /projects '' "$TMP/projects.json" "$TOKEN"); assert_code "$code" projects; assert_success "$TMP/projects.json" projects
PROJECT_ID=$(json_query "$TMP/projects.json" "next(p['id'] for p in j['data'] if p['key']=='MOB')")
echo "project_id=$PROJECT_ID"

code=$(curl_json GET "/projects/$PROJECT_ID" '' "$TMP/project.json" "$TOKEN"); assert_code "$code" project; assert_success "$TMP/project.json" project
ISSUE_TYPE_ID=$(json_query "$TMP/project.json" "j['data']['issueTypes'][0]['id'] if 'issueTypes' in j['data'] else j['data']['workflows'][0]['statuses'][0]['id'] and ''")
if [ -z "$ISSUE_TYPE_ID" ]; then
  code=$(curl_json GET "/projects/$PROJECT_ID/issue-types" '' "$TMP/types.json" "$TOKEN"); assert_code "$code" issue_types; assert_success "$TMP/types.json" issue_types
  ISSUE_TYPE_ID=$(json_query "$TMP/types.json" "j['data'][0]['id']")
fi
STATUS_ID=$(json_query "$TMP/project.json" "j['data']['workflows'][0]['statuses'][0]['id']")
echo "issue_type_id=$ISSUE_TYPE_ID status_id=$STATUS_ID"

# Find dev1 user id from project members.
code=$(curl_json GET "/projects/$PROJECT_ID/members" '' "$TMP/members.json" "$TOKEN"); assert_code "$code" members; assert_success "$TMP/members.json" members
DEV1_ID=$(json_query "$TMP/members.json" "next(m['user']['id'] for m in j['data'] if m['user']['email']=='$DEV1_EMAIL')")
echo "dev1_id=$DEV1_ID"

# Create a temporary custom field so UC-08 covers custom field values without waiting for UC-17 UI depth.
CF_KEY="qa_uc08_$STAMP"
echo "Create custom field $CF_KEY"
code=$(curl_json POST "/projects/$PROJECT_ID/custom-fields" "{\"name\":\"QA UC08 $STAMP\",\"key\":\"$CF_KEY\",\"type\":\"TEXT\",\"isRequired\":false}" "$TMP/cf.json" "$TOKEN"); assert_code "$code" custom_field; pretty "$TMP/cf.json"; assert_success "$TMP/cf.json" custom_field
CUSTOM_FIELD_ID=$(extract "$TMP/cf.json" data.id)

echo "UC-08 create parent issue"
DUE=$(date -u -d '+7 days' +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -v+7d +%Y-%m-%dT00:00:00.000Z)
PARENT_BODY=$(python3 - <<PY
import json
print(json.dumps({
  'issueTypeId': '$ISSUE_TYPE_ID',
  'workflowStatusId': '$STATUS_ID',
  'title': 'UC08 parent issue $STAMP',
  'description': 'Created by smoke test for UC-08 through UC-16',
  'priority': 'HIGH',
  'labels': ['qa', 'uc08'],
  'storyPoints': 5,
  'originalEstimate': 3600,
  'remainingEstimate': 3600,
  'dueDate': '$DUE',
  'customFields': {'$CUSTOM_FIELD_ID': 'custom value $STAMP'}
}))
PY
)
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "$PARENT_BODY" "$TMP/parent-create.json" "$TOKEN"); assert_code "$code" create_issue; pretty "$TMP/parent-create.json"; assert_success "$TMP/parent-create.json" create_issue
PARENT_ID=$(extract "$TMP/parent-create.json" data.id)
PARENT_KEY=$(extract "$TMP/parent-create.json" data.key)
echo "parent=$PARENT_KEY $PARENT_ID"

echo "UC-09/UC-11 update issue and assign dev1"
UPDATE_BODY=$(python3 - <<PY
import json
print(json.dumps({'title':'UC09 updated parent issue $STAMP','description':'Updated description for UC-09','priority':'CRITICAL','assigneeId':'$DEV1_ID','labels':['qa','uc09','assigned'],'originalEstimate':7200,'remainingEstimate':5400,'customFields': {'$CUSTOM_FIELD_ID':'updated custom value $STAMP'}}))
PY
)
code=$(curl_json PATCH "/projects/$PROJECT_ID/issues/$PARENT_ID" "$UPDATE_BODY" "$TMP/parent-update.json" "$TOKEN"); assert_code "$code" update_issue; pretty "$TMP/parent-update.json"; assert_success "$TMP/parent-update.json" update_issue

python3 - "$TMP/parent-update.json" "$DEV1_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); data=j['data']; dev=sys.argv[2]
assert data['assignee']['id']==dev, data.get('assignee')
assert any((x.get('label') or x).get('name')=='uc09' for x in data.get('labels', [])), data.get('labels')
assert any(v.get('value','').startswith('updated custom value') for v in data.get('customFieldValues', [])), data.get('customFieldValues')
print('uc09_uc11_update_verified=true')
PY

echo "UC-12 create sub-task"
SUB_BODY=$(python3 - <<PY
import json
print(json.dumps({'issueTypeId':'$ISSUE_TYPE_ID','workflowStatusId':'$STATUS_ID','title':'UC12 sub-task $STAMP','description':'Sub-task smoke test','priority':'MEDIUM','parentId':'$PARENT_ID'}))
PY
)
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "$SUB_BODY" "$TMP/sub-create.json" "$TOKEN"); assert_code "$code" subtask; pretty "$TMP/sub-create.json"; assert_success "$TMP/sub-create.json" subtask
SUB_ID=$(extract "$TMP/sub-create.json" data.id); SUB_KEY=$(extract "$TMP/sub-create.json" data.key)
echo "subtask=$SUB_KEY $SUB_ID"

echo "Create target issue for UC-13 link"
TARGET_BODY=$(python3 - <<PY
import json
print(json.dumps({'issueTypeId':'$ISSUE_TYPE_ID','workflowStatusId':'$STATUS_ID','title':'UC13 linked target $STAMP','description':'Target for link smoke','priority':'LOW'}))
PY
)
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "$TARGET_BODY" "$TMP/target-create.json" "$TOKEN"); assert_code "$code" target; assert_success "$TMP/target-create.json" target
TARGET_KEY=$(extract "$TMP/target-create.json" data.key); TARGET_ID=$(extract "$TMP/target-create.json" data.id)
echo "target=$TARGET_KEY $TARGET_ID"

echo "UC-13 link issues"
code=$(curl_json POST "/projects/$PROJECT_ID/issues/$PARENT_ID/link" "{\"targetIssueKey\":\"$TARGET_KEY\",\"type\":\"RELATES_TO\"}" "$TMP/link.json" "$TOKEN"); assert_code "$code" link; pretty "$TMP/link.json"; assert_success "$TMP/link.json" link
LINK_ID=$(extract "$TMP/link.json" data.id)

echo "UC-14 add comment with mention"
COMMENT_BODY="Smoke UC14 comment mentioning @$DEV1_EMAIL for issue $PARENT_KEY"
code=$(curl_json POST "/issues/$PARENT_ID/comments" "{\"body\":\"$COMMENT_BODY\"}" "$TMP/comment.json" "$TOKEN"); assert_code "$code" comment; pretty "$TMP/comment.json"; assert_success "$TMP/comment.json" comment
COMMENT_ID=$(extract "$TMP/comment.json" data.id)

echo "UC-15 attach file"
echo "UC15 attachment smoke $STAMP" > "$TMP/uc15-attachment.txt"
ATTACH_CODE=$(curl -sS -o "$TMP/attachment.json" -w "%{http_code}" -X POST "$BASE_URL/issues/$PARENT_ID/attachments" \
  -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TMP/uc15-attachment.txt;type=text/plain")
assert_code "$ATTACH_CODE" attachment
pretty "$TMP/attachment.json"; assert_success "$TMP/attachment.json" attachment
ATTACH_ID=$(extract "$TMP/attachment.json" data.id)

code=$(curl_json GET "/issues/$PARENT_ID/attachments/$ATTACH_ID/url" '' "$TMP/attachment-url.json" "$TOKEN"); assert_code "$code" attachment_url; pretty "$TMP/attachment-url.json"; assert_success "$TMP/attachment-url.json" attachment_url

echo "UC-16 view issue history and full detail"
code=$(curl_json GET "/projects/$PROJECT_ID/issues/$PARENT_ID" '' "$TMP/detail.json" "$TOKEN"); assert_code "$code" detail; assert_success "$TMP/detail.json" detail
python3 - "$TMP/detail.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); d=j['data']
assert d['children'], 'expected sub-task child'
assert d['sourceLinks'], 'expected source link'
assert d['comments'], 'expected comment'
assert d['attachments'], 'expected attachment'
fields={h['field'] for h in d.get('histories', [])}
for expected in ['created','title','description','priority','assigneeId','labels','comment','link','attachment.added']:
    assert expected in fields, f'missing history field {expected}; got {fields}'
print('uc16_full_detail_history_verified=true')
PY

code=$(curl_json GET "/projects/$PROJECT_ID/issues/$PARENT_ID/history" '' "$TMP/history.json" "$TOKEN"); assert_code "$code" history; pretty "$TMP/history.json"; assert_success "$TMP/history.json" history

echo "Verify mention notification for dev1 in DB"
docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform -v email="$DEV1_EMAIL" -v comment="$COMMENT_ID" -At <<'SQL' > "$TMP/mention-count.txt"
SELECT count(*)
FROM "Notification" n
JOIN "User" u ON u.id = n."userId"
WHERE u.email = :'email'
  AND n."entityId" = :'comment';
SQL
MENTION_COUNT=$(tr -d '[:space:]' < "$TMP/mention-count.txt")
echo "mention_notification_count=$MENTION_COUNT"
if [ "${MENTION_COUNT:-0}" -lt 1 ]; then echo "Expected mention notification for $DEV1_EMAIL" >&2; exit 1; fi

echo "UC-10 delete issue and cascade sub-task"
code=$(curl_json DELETE "/projects/$PROJECT_ID/issues/$PARENT_ID" '' "$TMP/delete.json" "$TOKEN"); [ "$code" = "204" ] || { echo "Expected delete HTTP 204 got $code" >&2; pretty "$TMP/delete.json"; exit 1; }
echo "delete_http_code=$code"

code=$(curl_json GET "/projects/$PROJECT_ID/issues/$PARENT_ID" '' "$TMP/deleted-parent.json" "$TOKEN"); echo "deleted_parent_get_http_code=$code"; [ "$code" = "404" ] || { echo "Expected deleted parent 404" >&2; pretty "$TMP/deleted-parent.json"; exit 1; }
code=$(curl_json GET "/projects/$PROJECT_ID/issues/$SUB_ID" '' "$TMP/deleted-sub.json" "$TOKEN"); echo "deleted_subtask_get_http_code=$code"; [ "$code" = "404" ] || { echo "Expected deleted sub-task cascade 404" >&2; pretty "$TMP/deleted-sub.json"; exit 1; }

echo
cat <<DONE
UC-08 to UC-16 issue tracker smoke test passed
- UC-08 create issue with type, fields, priority, labels, custom field values
- UC-09 edit issue and changelog
- UC-10 delete issue and cascade sub-task
- UC-11 assign issue and notification path
- UC-12 create sub-task
- UC-13 link issue
- UC-14 add comment with mention
- UC-15 attach file and presigned URL
- UC-16 view full issue history
DONE
