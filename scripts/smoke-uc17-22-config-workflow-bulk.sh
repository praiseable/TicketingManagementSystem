#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }

curl_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ "$method" != "GET" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}"
}

assert_success() {
  local file="$1" label="$2"
  python3 - "$file" "$label" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); label=sys.argv[2]
assert j.get('success') is True, j
print(f'{label}=true')
PY
}

value() {
  python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); expr=sys.argv[2]
data=j.get('data')
if expr == 'token': print(data['tokens']['accessToken'])
elif expr == 'firstProjectId': print(data[0]['id'])
elif expr == 'id': print(data['id'])
elif expr == 'firstDataId': print(data[0]['id'])
elif expr == 'workflowFirstStatus': print(data['statuses'][0]['id'])
elif expr == 'workflowSecondStatus': print(data['statuses'][1]['id'])
elif expr == 'workflowThirdStatus': print(data['statuses'][2]['id'])
elif expr == 'issueId': print(data['id'])
elif expr == 'key': print(data.get('key',''))
PY
}

echo "Login admin"
code=$(curl_json POST /auth/login '{"email":"admin@acme.com","password":"Test@1234"}' "$TMP/login.json")
[ "$code" = "200" ] || { pretty "$TMP/login.json"; echo "login failed $code"; exit 1; }
TOKEN=$(value "$TMP/login.json" token)

code=$(curl_json GET /projects '' "$TMP/projects.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/projects.json"; exit 1; }
PROJECT_ID=$(value "$TMP/projects.json" firstProjectId)
echo "PROJECT_ID=$PROJECT_ID"

echo "UC-17 create custom field"
FIELD_KEY="qa_gate_${STAMP}"
code=$(curl_json POST "/projects/$PROJECT_ID/custom-fields" "{\"name\":\"QA Gate $STAMP\",\"key\":\"$FIELD_KEY\",\"type\":\"TEXT\",\"isRequired\":true}" "$TMP/field.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/field.json"; echo "field failed $code"; exit 1; }
pretty "$TMP/field.json"; assert_success "$TMP/field.json" custom_field
FIELD_ID=$(value "$TMP/field.json" id)

echo "UC-18 create issue type"
code=$(curl_json POST "/projects/$PROJECT_ID/issue-types" "{\"name\":\"QA Type $STAMP\",\"color\":\"#7c3aed\",\"icon\":\"sparkles\",\"customFieldIds\":[\"$FIELD_ID\"]}" "$TMP/type.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/type.json"; echo "type failed $code"; exit 1; }
pretty "$TMP/type.json"; assert_success "$TMP/type.json" issue_type
TYPE_ID=$(value "$TMP/type.json" id)

echo "UC-20 create workflow"
WF_NAME="QA Workflow $STAMP"
code=$(curl_json POST "/projects/$PROJECT_ID/workflows" "{\"name\":\"$WF_NAME\"}" "$TMP/workflow.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/workflow.json"; echo "workflow failed $code"; exit 1; }
pretty "$TMP/workflow.json"; assert_success "$TMP/workflow.json" workflow
WF_ID=$(value "$TMP/workflow.json" id)

for payload in \
  "{\"name\":\"Ready $STAMP\",\"category\":\"TODO\",\"color\":\"#64748b\"}" \
  "{\"name\":\"QA Review $STAMP\",\"category\":\"IN_PROGRESS\",\"color\":\"#f59e0b\",\"wipLimit\":3}" \
  "{\"name\":\"Accepted $STAMP\",\"category\":\"DONE\",\"color\":\"#22c55e\"}"; do
  code=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/statuses" "$payload" "$TMP/status.json" "$TOKEN")
  [ "$code" = "201" ] || { pretty "$TMP/status.json"; echo "status failed $code"; exit 1; }
done

code=$(curl_json GET "/projects/$PROJECT_ID/workflows/$WF_ID" '' "$TMP/workflow-full.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/workflow-full.json"; exit 1; }
READY_ID=$(value "$TMP/workflow-full.json" workflowFirstStatus)
REVIEW_ID=$(value "$TMP/workflow-full.json" workflowSecondStatus)
ACCEPT_ID=$(value "$TMP/workflow-full.json" workflowThirdStatus)
echo "READY=$READY_ID REVIEW=$REVIEW_ID ACCEPT=$ACCEPT_ID"

code=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions" "{\"fromStatusId\":\"$READY_ID\",\"toStatusId\":\"$REVIEW_ID\",\"name\":\"Start review\"}" "$TMP/tr1.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/tr1.json"; echo "transition1 failed $code"; exit 1; }
code=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions" "{\"fromStatusId\":\"$REVIEW_ID\",\"toStatusId\":\"$ACCEPT_ID\",\"name\":\"Accept\"}" "$TMP/tr2.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/tr2.json"; echo "transition2 failed $code"; exit 1; }
TR2_ID=$(value "$TMP/tr2.json" id)

echo "UC-21 add required-field guard"
code=$(curl_json POST "/projects/$PROJECT_ID/workflows/$WF_ID/transitions/$TR2_ID/guards" "{\"type\":\"REQUIRED_FIELD\",\"fieldId\":\"$FIELD_ID\",\"config\":{}}" "$TMP/guard.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/guard.json"; echo "guard failed $code"; exit 1; }
pretty "$TMP/guard.json"; assert_success "$TMP/guard.json" transition_guard

echo "Create issue in guarded workflow"
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "{\"issueTypeId\":\"$TYPE_ID\",\"workflowStatusId\":\"$READY_ID\",\"title\":\"Guarded issue $STAMP\",\"priority\":\"MEDIUM\"}" "$TMP/issue.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/issue.json"; echo "issue failed $code"; exit 1; }
ISSUE_ID=$(value "$TMP/issue.json" issueId)

echo "Transition Ready -> QA Review"
code=$(curl_json POST "/projects/$PROJECT_ID/issues/$ISSUE_ID/transition" "{\"toStatusId\":\"$REVIEW_ID\"}" "$TMP/move1.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/move1.json"; echo "move1 failed $code"; exit 1; }
assert_success "$TMP/move1.json" guarded_move_start

echo "Guard should block QA Review -> Accepted while custom field is empty"
code=$(curl_json POST "/projects/$PROJECT_ID/issues/$ISSUE_ID/transition" "{\"toStatusId\":\"$ACCEPT_ID\"}" "$TMP/guard-block.json" "$TOKEN")
if [ "$code" != "422" ]; then pretty "$TMP/guard-block.json"; echo "expected 422 guard block, got $code"; exit 1; fi
pretty "$TMP/guard-block.json"

echo "Fill required custom field and transition again"
code=$(curl_json PATCH "/projects/$PROJECT_ID/issues/$ISSUE_ID" "{\"customFields\":{\"$FIELD_ID\":\"approved\"}}" "$TMP/fill.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/fill.json"; echo "fill failed $code"; exit 1; }
code=$(curl_json POST "/projects/$PROJECT_ID/issues/$ISSUE_ID/transition" "{\"toStatusId\":\"$ACCEPT_ID\"}" "$TMP/move2.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/move2.json"; echo "move2 failed $code"; exit 1; }
assert_success "$TMP/move2.json" guarded_move_pass

echo "UC-22 bulk update issues"
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "{\"title\":\"Bulk A $STAMP\",\"priority\":\"LOW\"}" "$TMP/bulk-a.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/bulk-a.json"; exit 1; }
A_ID=$(value "$TMP/bulk-a.json" issueId)
code=$(curl_json POST "/projects/$PROJECT_ID/issues" "{\"title\":\"Bulk B $STAMP\",\"priority\":\"LOW\"}" "$TMP/bulk-b.json" "$TOKEN")
[ "$code" = "201" ] || { pretty "$TMP/bulk-b.json"; exit 1; }
B_ID=$(value "$TMP/bulk-b.json" issueId)
code=$(curl_json POST "/projects/$PROJECT_ID/issues/bulk" "{\"issueIds\":[\"$A_ID\",\"$B_ID\"],\"action\":\"PRIORITY\",\"value\":\"HIGH\"}" "$TMP/bulk-priority.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/bulk-priority.json"; echo "bulk priority failed $code"; exit 1; }
assert_success "$TMP/bulk-priority.json" bulk_priority
code=$(curl_json POST "/projects/$PROJECT_ID/issues/bulk" "{\"issueIds\":[\"$A_ID\",\"$B_ID\"],\"action\":\"LABEL\",\"value\":\"qa-bulk-$STAMP\"}" "$TMP/bulk-label.json" "$TOKEN")
[ "$code" = "200" ] || { pretty "$TMP/bulk-label.json"; echo "bulk label failed $code"; exit 1; }
assert_success "$TMP/bulk-label.json" bulk_label

echo "UC-17 to UC-22 configuration/workflow/bulk smoke test passed"
