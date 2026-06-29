#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@acme.com}"
ADMIN_PASS="${ADMIN_PASS:-Test@1234}"
STAMP="$(date +%s)"
PROJECT_KEY="T${STAMP: -8}"
PROJECT_NAME="QA Project $STAMP"
INVITE_EMAIL="dev1@acme.com"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }

curl_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" auth="${5:-}"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  if [ "$method" != "GET" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
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

json_value() {
  local file="$1" expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); expr=sys.argv[2]
data=j.get('data')
if expr == 'access': print(data['tokens']['accessToken'])
elif expr == 'project_id': print(data['id'])
elif expr == 'member_dev1':
    rows=data if isinstance(data, list) else []
    row=next((r for r in rows if (r.get('user') or {}).get('email') == 'dev1@acme.com'), None)
    print((row or {}).get('userId',''))
elif expr == 'member_dev1_role':
    rows=data if isinstance(data, list) else []
    row=next((r for r in rows if (r.get('user') or {}).get('email') == 'dev1@acme.com'), None)
    print((row or {}).get('role',''))
elif expr == 'issue_type_count': print(len(data.get('issueTypes') or []))
elif expr == 'workflow_status_count':
    workflows=data.get('workflows') or []
    print(len((workflows[0] or {}).get('statuses') or []) if workflows else 0)
else: print('')
PY
}

echo "UC-04 to UC-07 health"
code="$(curl_json GET /health '' "$TMP/health.json")"; [ "$code" = 200 ]; pretty "$TMP/health.json"; assert_success "$TMP/health.json" health

echo
echo "Login as $ADMIN_EMAIL"
code="$(curl_json POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" "$TMP/login.json")"; [ "$code" = 200 ]; pretty "$TMP/login.json"; assert_success "$TMP/login.json" login
TOKEN="$(json_value "$TMP/login.json" access)"

echo
echo "UC-04 get organization"
code="$(curl_json GET /org '' "$TMP/org.json" "$TOKEN")"; [ "$code" = 200 ]; pretty "$TMP/org.json"; assert_success "$TMP/org.json" org_get

echo
echo "UC-04 update organization settings"
code="$(curl_json PATCH /org "{\"settings\":{\"qaLastOrgSettingsSmoke\":\"$STAMP\"}}" "$TMP/org-update.json" "$TOKEN")"; [ "$code" = 200 ]; pretty "$TMP/org-update.json"; assert_success "$TMP/org-update.json" org_update

echo
echo "UC-05 create project $PROJECT_KEY"
body="{\"name\":\"$PROJECT_NAME\",\"key\":\"$PROJECT_KEY\",\"description\":\"Smoke test project for UC-05\"}"
code="$(curl_json POST /projects "$body" "$TMP/project-create.json" "$TOKEN")"; [ "$code" = 201 ]; pretty "$TMP/project-create.json"; assert_success "$TMP/project-create.json" project_create
PROJECT_ID="$(json_value "$TMP/project-create.json" project_id)"
ISSUE_TYPE_COUNT="$(json_value "$TMP/project-create.json" issue_type_count)"
STATUS_COUNT="$(json_value "$TMP/project-create.json" workflow_status_count)"
[ "$ISSUE_TYPE_COUNT" -ge 3 ] || { echo "Expected >=3 issue types, got $ISSUE_TYPE_COUNT" >&2; exit 1; }
[ "$STATUS_COUNT" -ge 5 ] || { echo "Expected >=5 workflow statuses, got $STATUS_COUNT" >&2; exit 1; }
echo "project_id=$PROJECT_ID issue_types=$ISSUE_TYPE_COUNT statuses=$STATUS_COUNT"

echo
echo "UC-06 invite existing org member $INVITE_EMAIL"
code="$(curl_json POST "/projects/$PROJECT_ID/invite" "{\"email\":\"$INVITE_EMAIL\",\"role\":\"MEMBER\"}" "$TMP/invite.json" "$TOKEN")"; [ "$code" = 201 ]; pretty "$TMP/invite.json"; assert_success "$TMP/invite.json" invite

echo
echo "UC-07 confirm member added"
code="$(curl_json GET "/projects/$PROJECT_ID/members" '' "$TMP/members.json" "$TOKEN")"; [ "$code" = 200 ]; pretty "$TMP/members.json"; assert_success "$TMP/members.json" members
DEV1_ID="$(json_value "$TMP/members.json" member_dev1)"
[ -n "$DEV1_ID" ] || { echo "dev1 member not found after invite" >&2; exit 1; }
echo "dev1_user_id=$DEV1_ID"

echo
echo "UC-07 update member role MEMBER -> ADMIN"
code="$(curl_json PATCH "/projects/$PROJECT_ID/members/$DEV1_ID" "{\"role\":\"ADMIN\"}" "$TMP/member-role.json" "$TOKEN")"; [ "$code" = 200 ]; pretty "$TMP/member-role.json"; assert_success "$TMP/member-role.json" member_role_update

code="$(curl_json GET "/projects/$PROJECT_ID/members" '' "$TMP/members-after-role.json" "$TOKEN")"; [ "$code" = 200 ]
DEV1_ROLE="$(json_value "$TMP/members-after-role.json" member_dev1_role)"
[ "$DEV1_ROLE" = "ADMIN" ] || { echo "dev1 role was not updated to ADMIN; got $DEV1_ROLE" >&2; exit 1; }
echo "dev1_role=$DEV1_ROLE"

echo
echo "UC-07 remove member"
code="$(curl_json DELETE "/projects/$PROJECT_ID/members/$DEV1_ID" '' "$TMP/member-remove.json" "$TOKEN")"; [ "$code" = 204 ] || { echo "Expected 204 on remove, got $code" >&2; pretty "$TMP/member-remove.json"; exit 1; }
echo "member_removed=true"

echo
echo "UC-04 to UC-07 organization/project/member smoke test passed"
