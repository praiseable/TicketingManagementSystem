#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@acme.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test@1234}"
DEV_EMAIL="${DEV_EMAIL:-dev1@acme.com}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STAMP="$(date +%s)"

api_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS --max-time 25 -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -o "$out" -w "%{http_code}")
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  if [ "$method" != "GET" ]; then [ -n "$body" ] || body='{}'; args+=(-H "Content-Type: application/json" --data-raw "$body"); fi
  curl "${args[@]}"
}
pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
assert_success() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); label=sys.argv[2]
assert j.get('success') is True, j
print(f"{label}=true")
PY
}
extract() { python3 - "$1" "$2" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); d=j.get('data'); key=sys.argv[2]
if key == 'access': print((d.get('tokens') or {}).get('accessToken',''))
elif key == 'id': print(d.get('id','') if isinstance(d, dict) else '')
elif key == 'first_id': print((d[0] if isinstance(d, list) and d else {}).get('id',''))
elif key == 'data_id': print(d.get('id','') if isinstance(d, dict) else '')
elif key == 'scheme_id': print(d.get('id','') if isinstance(d, dict) else '')
elif key == 'active_scheme': print(d.get('activeSchemeId','') if isinstance(d, dict) else '')
elif key == 'group_id': print(d.get('id','') if isinstance(d, dict) else '')
elif key == 'issue_id': print(d.get('id','') if isinstance(d, dict) else '')
elif key == 'issue_key': print(d.get('key','') if isinstance(d, dict) else '')
elif key == 'items_len': print(len((d or {}).get('items',[]) if isinstance(d, dict) else []))
elif key == 'redirect': print((d or {}).get('redirectUrl') or '')
PY
}

CODE=$(api_json POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "$TMP/login.json")
[ "$CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }
TOKEN=$(extract "$TMP/login.json" access)
[ -n "$TOKEN" ] || { echo "admin token missing" >&2; pretty "$TMP/login.json"; exit 1; }
echo "admin_login=true"

CODE=$(api_json POST /projects "{\"name\":\"Final Phase Project $STAMP\",\"key\":\"F$((STAMP % 100000000))\",\"description\":\"UC69-73 smoke\"}" "$TMP/project.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }
assert_success "$TMP/project.json" "project_create"
PROJECT_ID=$(extract "$TMP/project.json" id)
PROJECT_KEY=$(python3 - "$TMP/project.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))['data']['key'])
PY
)

# UC-69 Permission schemes
CODE=$(api_json POST "/projects/$PROJECT_ID/permission-schemes" "{\"name\":\"QA Permission Scheme $STAMP\",\"description\":\"Permission scheme smoke\",\"rules\":{\"browse\":[\"OWNER\",\"ADMIN\",\"MEMBER\"],\"editIssue\":[\"OWNER\",\"ADMIN\"],\"manageProject\":[\"OWNER\"]}}" "$TMP/scheme.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/scheme.json"; exit 1; }
assert_success "$TMP/scheme.json" "permission_scheme_create"
SCHEME_ID=$(extract "$TMP/scheme.json" scheme_id)
CODE=$(api_json POST "/projects/$PROJECT_ID/permission-schemes/$SCHEME_ID/apply" '{}' "$TMP/scheme-apply.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/scheme-apply.json"; exit 1; }
assert_success "$TMP/scheme-apply.json" "permission_scheme_apply"
CODE=$(api_json GET "/projects/$PROJECT_ID/permission-schemes" '{}' "$TMP/schemes.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/schemes.json"; exit 1; }
python3 - "$TMP/schemes.json" "$SCHEME_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); sid=sys.argv[2]
assert j['data']['activeSchemeId'] == sid, j
print('permission_scheme_list=true')
PY

# UC-70 User groups
DEV1_ID=$(docker exec -i pm-platform-postgres psql -U pmuser -d pmplatform -At <<'SQL'
SELECT id FROM "User" WHERE email='dev1@acme.com' LIMIT 1;
SQL
)
[ -n "$DEV1_ID" ] || { echo "dev1 user missing" >&2; exit 1; }
CODE=$(api_json POST /admin/groups "{\"name\":\"QA Group $STAMP\",\"description\":\"Group smoke\"}" "$TMP/group.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/group.json"; exit 1; }
assert_success "$TMP/group.json" "group_create"
GROUP_ID=$(extract "$TMP/group.json" group_id)
CODE=$(api_json POST "/admin/groups/$GROUP_ID/users" "{\"userId\":\"$DEV1_ID\"}" "$TMP/group-user.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/group-user.json"; exit 1; }
assert_success "$TMP/group-user.json" "group_add_user"
CODE=$(api_json GET /admin/groups '{}' "$TMP/groups.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/groups.json"; exit 1; }
python3 - "$TMP/groups.json" "$GROUP_ID" "$DEV1_ID" <<'PY'
import json, sys
groups=json.load(open(sys.argv[1]))['data']; gid=sys.argv[2]; uid=sys.argv[3]
g=next((x for x in groups if x['id']==gid), None)
assert g and any(u['id']==uid for u in g.get('users',[])), groups
print('group_list_user=true')
PY

# UC-71 / UC-72 Roadmap + reschedule
CODE=$(api_json GET "/projects/$PROJECT_ID/issue-types" '{}' "$TMP/types.json" "$TOKEN")
TYPE_ID=$(extract "$TMP/types.json" first_id)
CODE=$(api_json GET "/projects/$PROJECT_ID/workflows" '{}' "$TMP/workflows.json" "$TOKEN")
STATUS_ID=$(python3 - "$TMP/workflows.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))['data'][0]['statuses'][0]['id'])
PY
)
START_DATE="2026-07-10T00:00:00.000Z"
END_DATE="2026-07-17T00:00:00.000Z"
CODE=$(api_json POST "/projects/$PROJECT_ID/issues" "{\"title\":\"Roadmap task $STAMP\",\"issueTypeId\":\"$TYPE_ID\",\"workflowStatusId\":\"$STATUS_ID\",\"priority\":\"HIGH\",\"storyPoints\":5,\"dueDate\":\"$END_DATE\"}" "$TMP/issue.json" "$TOKEN")
[ "$CODE" = "201" ] || { pretty "$TMP/issue.json"; exit 1; }
assert_success "$TMP/issue.json" "roadmap_issue_create"
ISSUE_ID=$(extract "$TMP/issue.json" issue_id)
ISSUE_KEY=$(extract "$TMP/issue.json" issue_key)
CODE=$(api_json GET "/projects/$PROJECT_ID/roadmap" '{}' "$TMP/roadmap.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/roadmap.json"; exit 1; }
python3 - "$TMP/roadmap.json" "$ISSUE_ID" <<'PY'
import json, sys
items=json.load(open(sys.argv[1]))['data']['items']; iid=sys.argv[2]
assert any(i['id']==iid for i in items), items
print('gantt_timeline=true')
PY
NEW_START="2026-07-20T00:00:00.000Z"
NEW_END="2026-07-30T00:00:00.000Z"
CODE=$(api_json PATCH "/projects/$PROJECT_ID/roadmap/issues/$ISSUE_ID/reschedule" "{\"startDate\":\"$NEW_START\",\"endDate\":\"$NEW_END\"}" "$TMP/reschedule.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/reschedule.json"; exit 1; }
assert_success "$TMP/reschedule.json" "gantt_reschedule"
CODE=$(api_json GET "/projects/$PROJECT_ID/roadmap" '{}' "$TMP/roadmap2.json" "$TOKEN")
python3 - "$TMP/roadmap2.json" "$ISSUE_ID" <<'PY'
import json, sys
items=json.load(open(sys.argv[1]))['data']['items']; iid=sys.argv[2]
item=next(i for i in items if i['id']==iid)
assert item['endDate'].startswith('2026-07-30'), item
print('gantt_reschedule_persisted=true')
PY

# UC-73 SSO foundation
SSO_BODY="{\"enabled\":true,\"provider\":\"SAML\",\"entityId\":\"pbs-tms-$STAMP\",\"loginUrl\":\"https://idp.example.test/sso\",\"callbackUrl\":\"https://tms.pbos.gov.pk/api/auth/sso/callback\"}"
CODE=$(api_json PUT /auth/sso/config "$SSO_BODY" "$TMP/sso.json" "$TOKEN")
[ "$CODE" = "200" ] || { pretty "$TMP/sso.json"; exit 1; }
assert_success "$TMP/sso.json" "sso_config_update"
ORG_ID=$(python3 - "$TMP/login.json" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))['data']['user']['orgId'])
PY
)
CODE=$(api_json GET "/auth/sso/login-url?orgId=$ORG_ID" '{}' "$TMP/sso-url.json")
[ "$CODE" = "200" ] || { pretty "$TMP/sso-url.json"; exit 1; }
assert_success "$TMP/sso-url.json" "sso_login_url"
python3 - "$TMP/sso-url.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))['data']
assert j['enabled'] is True and j['provider']=='SAML' and j['redirectUrl'], j
print('sso_foundation=true')
PY

echo "UC-69 to UC-73 final Phase 3 smoke test passed"
