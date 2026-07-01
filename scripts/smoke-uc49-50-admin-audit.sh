#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@acme.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test@1234}"
TARGET_EMAIL="${TARGET_EMAIL:-dev2@acme.com}"
TARGET_RESET_PASSWORD="AdminReset@1234"
TARGET_FINAL_PASSWORD="Test@1234"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
pretty() { python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
api_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out="$4"
  local token="${5:-}"

  local curl_args=(
    -sS
    --max-time 25
    -X "$method"
    "$BASE_URL$path"
    -H "Host: $HOST_HEADER"
    -H "Origin: $ORIGIN"
    -o "$out"
    -w "%{http_code}"
  )

  if [ -n "$token" ]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi

  if [ "$method" != "GET" ]; then
    if [ -z "$body" ]; then
      body="{}"
    fi

    curl_args+=(
      -H "Content-Type: application/json"
      --data-raw "$body"
    )
  fi

  curl "${curl_args[@]}"
}
assert_success() { local file="$1" label="$2"; python3 - "$file" "$label" <<'PY'
import json, sys
j=json.load(open(sys.argv[1]))
if j.get('success') is not True:
 print(json.dumps(j,indent=2), file=sys.stderr); raise SystemExit(f"{sys.argv[2]} failed")
print(f"{sys.argv[2]}=true")
PY
}
extract() { local file="$1" expr="$2"; python3 - "$file" "$expr" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); e=sys.argv[2]
if e=='access': print(j['data']['tokens']['accessToken'])
elif e=='first_id': print(j['data'][0]['id'] if j.get('data') else '')
elif e=='first_email': print(j['data'][0]['email'] if j.get('data') else '')
elif e=='temp_password': print(j.get('data',{}).get('temporaryPassword',''))
PY
}
echo "Login admin"
curl -sS --max-time 25 -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -H "Host: $HOST_HEADER" \
  -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  > "$TMP_DIR/login.json"

echo "Admin login response:"
pretty "$TMP_DIR/login.json"

ADMIN_TOKEN="$(python3 - "$TMP_DIR/login.json" <<'PYJSON'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
raw = path.read_text().strip()

if not raw:
    raise SystemExit("admin login returned empty response")

j = json.loads(raw)

if j.get("success") is not True:
    print(json.dumps(j, indent=2), file=sys.stderr)
    raise SystemExit("admin login failed")

try:
    print(j["data"]["tokens"]["accessToken"])
except KeyError:
    print(json.dumps(j, indent=2), file=sys.stderr)
    raise SystemExit("admin login response missing data.tokens.accessToken")
PYJSON
)"

[ -n "$ADMIN_TOKEN" ] || { echo "admin login failed: empty ADMIN_TOKEN" >&2; pretty "$TMP_DIR/login.json"; exit 1; }
echo "admin_login=true"
echo "UC-49 list users"
api_json GET "/admin/users?limit=100&q=$TARGET_EMAIL" '{}' "$TMP_DIR/users-target.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/users-target.json"; assert_success "$TMP_DIR/users-target.json" "admin_users_list"
TARGET_ID="$(extract "$TMP_DIR/users-target.json" first_id)"; FOUND_EMAIL="$(extract "$TMP_DIR/users-target.json" first_email)"
[ -n "$TARGET_ID" ] && [ "$FOUND_EMAIL" = "$TARGET_EMAIL" ] || { echo "target user not found: $TARGET_EMAIL" >&2; exit 1; }
echo "TARGET_ID=$TARGET_ID"
echo "UC-49 activate user baseline"
api_json PATCH "/admin/users/$TARGET_ID/activate" '{}' "$TMP_DIR/activate.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/activate.json"
assert_success "$TMP_DIR/activate.json" "admin_user_activate"
echo "UC-49 change role MEMBER -> ADMIN"
api_json PATCH "/admin/users/$TARGET_ID/role" '{"role":"ADMIN"}' "$TMP_DIR/role-admin.json" "$ADMIN_TOKEN" >/dev/null; pretty "$TMP_DIR/role-admin.json"; assert_success "$TMP_DIR/role-admin.json" "admin_user_role_admin"
python3 - "$TMP_DIR/role-admin.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); assert j['data']['role']=='ADMIN', j
PY
echo "UC-49 deactivate user"
api_json PATCH "/admin/users/$TARGET_ID/deactivate" '{}' "$TMP_DIR/deactivate.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/deactivate.json"
assert_success "$TMP_DIR/deactivate.json" "admin_user_deactivate"
python3 - "$TMP_DIR/deactivate.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); assert j['data']['isActive'] is False, j
PY
echo "UC-49 activate user"
api_json PATCH "/admin/users/$TARGET_ID/activate" '{}' "$TMP_DIR/activate2.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/activate2.json"
assert_success "$TMP_DIR/activate2.json" "admin_user_activate_again"
echo "UC-49 reset user password"
api_json PATCH "/admin/users/$TARGET_ID/password" "{\"password\":\"$TARGET_RESET_PASSWORD\"}" "$TMP_DIR/reset.json" "$ADMIN_TOKEN" >/dev/null; pretty "$TMP_DIR/reset.json"; assert_success "$TMP_DIR/reset.json" "admin_user_password_reset"
RESET_PASS="$(extract "$TMP_DIR/reset.json" temp_password)"; [ "$RESET_PASS" = "$TARGET_RESET_PASSWORD" ] || { echo "temporary password mismatch" >&2; exit 1; }
echo "UC-49 verify reset password login"
api_json POST /auth/login "{\"email\":\"$TARGET_EMAIL\",\"password\":\"$TARGET_RESET_PASSWORD\"}" "$TMP_DIR/target-login.json" >/dev/null; assert_success "$TMP_DIR/target-login.json" "admin_reset_password_login"
echo "UC-49 return user role/password to baseline"
api_json PATCH "/admin/users/$TARGET_ID/role" '{"role":"MEMBER"}' "$TMP_DIR/role-member.json" "$ADMIN_TOKEN" >/dev/null; assert_success "$TMP_DIR/role-member.json" "admin_user_role_member"
api_json PATCH "/admin/users/$TARGET_ID/password" "{\"password\":\"$TARGET_FINAL_PASSWORD\"}" "$TMP_DIR/reset-back.json" "$ADMIN_TOKEN" >/dev/null; assert_success "$TMP_DIR/reset-back.json" "admin_user_password_reset_back"
echo "UC-50 view audit log"
api_json GET "/admin/audit-log?limit=100&action=admin.user" '{}' "$TMP_DIR/audit.json" "$ADMIN_TOKEN" >/dev/null; pretty "$TMP_DIR/audit.json"; assert_success "$TMP_DIR/audit.json" "admin_audit_log"
python3 - "$TMP_DIR/audit.json" "$TARGET_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); target=sys.argv[2]
rows=j.get('data') or []; actions={r['action'] for r in rows if r.get('entityId')==target}
required={'admin.user.activate','admin.user.deactivate','admin.user.role','admin.user.password.reset'}
missing=required-actions
assert not missing, {'missing': list(missing), 'actions': sorted(actions)}
print('admin_audit_actions_verified=true')
PY
echo "UC-50 audit filters by entity/user/date"
TODAY="$(date -u +%Y-%m-%d)"
api_json GET "/admin/audit-log?limit=25&entityType=user&entityId=$TARGET_ID&from=$TODAY&to=$TODAY" '{}' "$TMP_DIR/audit-filtered.json" "$ADMIN_TOKEN" >/dev/null; assert_success "$TMP_DIR/audit-filtered.json" "admin_audit_filters"
python3 - "$TMP_DIR/audit-filtered.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); assert (j.get('meta') or {}).get('total',0) >= 1, j
print('admin_audit_filter_result=true')
PY
echo "UC-49/UC-50 admin user management and audit smoke test passed"
