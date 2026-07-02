#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1/api}"; HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"; ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"; STAMP="$(date +%s)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pretty(){ python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
curl_json(){ local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"; local args=(-sS --max-time 30 -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN"); [ -n "$token" ] && args+=(-H "Authorization: Bearer $token"); [ "$method" != "GET" ] && args+=(-H 'Content-Type: application/json' --data-raw "$body"); curl "${args[@]}"; }
extract(){ python3 - "$1" "$2" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); x=j
for p in sys.argv[2].split('.'):
    x=x[int(p)] if p.isdigit() else x[p]
print(x)
PY
}
LOGIN_CODE=$(curl_json POST /auth/login '{"email":"admin@acme.com","password":"Test@1234"}' "$TMP/login.json"); [ "$LOGIN_CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }; TOKEN=$(extract "$TMP/login.json" data.tokens.accessToken)
echo "UC-65 load test baseline"; USERS=12 ITERATIONS=1 BASE_URL="$BASE_URL" HOST_HEADER="$HOST_HEADER" ORIGIN="$ORIGIN" node scripts/loadtest-uc65-baseline.js > "$TMP/load.json"; pretty "$TMP/load.json"; python3 - "$TMP/load.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); assert j['success'] and j['requests'] >= 30, j; print('load_test_baseline=true')
PY
echo "UC-66/67/68 setup project"; PROJECT_KEY="J${STAMP: -7}"; CODE=$(curl_json POST /projects "{\"name\":\"JQL Smoke $STAMP\",\"key\":\"$PROJECT_KEY\",\"description\":\"JQL and post function smoke\"}" "$TMP/project.json" "$TOKEN"); [ "$CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }; PROJECT_ID=$(extract "$TMP/project.json" data.id); echo "project_create=true"
echo "Load issue types"
CODE=$(curl_json GET "/projects/$PROJECT_ID/issue-types" '' "$TMP/types.json" "$TOKEN"); TYPE_ID=$(extract "$TMP/types.json" data.0.id); echo "TYPE_ID=$TYPE_ID"
echo "Load workflows"
CODE=$(curl_json GET "/projects/$PROJECT_ID/workflows" '' "$TMP/workflows.json" "$TOKEN"); WF_ID=$(extract "$TMP/workflows.json" data.0.id); FROM_ID=$(extract "$TMP/workflows.json" data.0.statuses.0.id); TO_ID=$(extract "$TMP/workflows.json" data.0.statuses.1.id); echo "WF_ID=$WF_ID FROM_ID=$FROM_ID TO_ID=$TO_ID"
echo "Load project members"
CODE=$(curl_json GET "/projects/$PROJECT_ID/members" '' "$TMP/members.json" "$TOKEN"); ASSIGNEE_ID=$(extract "$TMP/members.json" data.0.user.id); echo "ASSIGNEE_ID=$ASSIGNEE_ID"
echo "Lookup dev1 user id"
DEV1_ID="$(
  timeout 10s docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform -At <<'SQL'
SELECT id FROM "User" WHERE email = 'dev1@acme.com' LIMIT 1;
SQL
)"
DEV1_ID="${DEV1_ID:-}"
echo "DEV1_ID=${DEV1_ID:-not-found}"
UNIQUE="jql-postfn-$STAMP"; LABEL="postfn-label-$STAMP"; CODE=$(curl_json POST "/projects/$PROJECT_ID/issues" "{\"issueTypeId\":\"$TYPE_ID\",\"workflowStatusId\":\"$FROM_ID\",\"title\":\"JQL Smoke Issue $UNIQUE\",\"description\":\"This issue verifies JQL and post functions $UNIQUE\",\"priority\":\"CRITICAL\",\"assigneeId\":\"$ASSIGNEE_ID\",\"labels\":[\"jql-smoke-$STAMP\"],\"storyPoints\":8}" "$TMP/issue.json" "$TOKEN"); [ "$CODE" = "201" ] || { pretty "$TMP/issue.json"; exit 1; }; ISSUE_ID=$(extract "$TMP/issue.json" data.id); ISSUE_KEY=$(extract "$TMP/issue.json" data.key); echo "issue_create=true"
echo "UC-66 query with JQL"; ENCODED=$(JQL="project:$PROJECT_KEY priority:CRITICAL text:$UNIQUE" python3 -c 'import os,urllib.parse; print(urllib.parse.quote(os.environ["JQL"]))'); CODE=$(curl_json GET "/search/jql?q=$ENCODED&limit=25" '' "$TMP/jql.json" "$TOKEN"); [ "$CODE" = "200" ] || { pretty "$TMP/jql.json"; exit 1; }; python3 - "$TMP/jql.json" "$ISSUE_ID" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); assert sys.argv[2] in [x.get('id') for x in j.get('data',[])], j; print('jql_query=true')
PY
echo "UC-67 JQL autocomplete"; CODE=$(curl_json GET "/search/jql/autocomplete?projectId=$PROJECT_ID&q=sta" '' "$TMP/auto.json" "$TOKEN"); [ "$CODE" = "200" ] || { pretty "$TMP/auto.json"; exit 1; }; python3 - "$TMP/auto.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); d=j.get('data') or {}; assert 'status' in d.get('fields',[]) or d.get('statuses'), j; print('jql_autocomplete=true')
PY
echo "UC-68 workflow post-functions"; CODE=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions" "{\"fromStatusId\":\"$FROM_ID\",\"toStatusId\":\"$TO_ID\",\"name\":\"Start with post functions\"}" "$TMP/tr.json" "$TOKEN"); [ "$CODE" = "201" ] || { pretty "$TMP/tr.json"; exit 1; }; TRANS_ID=$(extract "$TMP/tr.json" data.id)
CODE=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions/$TRANS_ID/post-functions" "{\"type\":\"AUTO_LABEL\",\"config\":{\"label\":\"$LABEL\",\"color\":\"#dc2626\"}}" "$TMP/pf1.json" "$TOKEN"); [ "$CODE" = "201" ] || { pretty "$TMP/pf1.json"; exit 1; }; echo "postfn_auto_label_create=true"
if [ -n "$DEV1_ID" ]; then CODE=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions/$TRANS_ID/post-functions" "{\"type\":\"AUTO_NOTIFY\",\"config\":{\"userIds\":[\"$DEV1_ID\"],\"title\":\"$ISSUE_KEY workflow post function\",\"body\":\"Post function notification smoke\"}}" "$TMP/pf2.json" "$TOKEN"); [ "$CODE" = "201" ] || { pretty "$TMP/pf2.json"; exit 1; }; echo "postfn_auto_notify_create=true"; fi
CODE=$(curl_json POST "/projects/$PROJECT_ID/issues/$ISSUE_ID/transition" "{\"toStatusId\":\"$TO_ID\",\"comment\":\"Run post-functions\"}" "$TMP/move.json" "$TOKEN"); [ "$CODE" = "200" ] || { pretty "$TMP/move.json"; exit 1; }; python3 - "$TMP/move.json" "$LABEL" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); label=sys.argv[2]; labels=[]
for row in (j.get('data') or {}).get('labels') or []:
    item=row.get('label') if isinstance(row,dict) else row
    labels.append(item.get('name') if isinstance(item,dict) else item)
assert label in labels, (label, labels, j); print('postfn_auto_label_applied=true')
PY
if [ -n "$DEV1_ID" ]; then
  echo "Check AUTO_NOTIFY notification"
  COUNT="$(
    timeout 10s docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform \
      -v user_id="$DEV1_ID" \
      -v issue_id="$ISSUE_ID" \
      -At <<'SQL'
SELECT count(*)
FROM "Notification"
WHERE "userId" = :'user_id'
  AND "entityType" = 'issue'
  AND "entityId" = :'issue_id';
SQL
  )"
  COUNT="${COUNT:-0}"
  echo "postfn_notification_count=$COUNT"
  [ "$COUNT" != "0" ] || { echo "post-function notification was not created" >&2; exit 1; }
  echo "postfn_auto_notify_applied=true"
fi
echo "UC-65 to UC-68 load/JQL/post-function smoke test passed"
