#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
STAMP="$(date +%s)"
SPACE_KEY="DOC$((STAMP % 100000))"
SPACE_NAME="Docs Smoke $STAMP"
ADMIN_EMAIL="admin@acme.com"
ADMIN_PASSWORD="Test@1234"
DEV_EMAIL="dev1@acme.com"
DEV_PASSWORD="Test@1234"

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
j=json.load(open(sys.argv[1])); e=sys.argv[2]; d=j.get('data') or {}
if e=='access':
  tokens = {}
  if isinstance(d, dict):
    tokens = d.get('tokens') or d.get('data', {}).get('tokens', {})
  print(tokens.get('accessToken', ''))
elif e=='id': print(d.get('id',''))
elif e=='version': print(d.get('version',''))
elif e=='versions_len': print(len(d if isinstance(d, list) else []))
elif e=='first_member_id': print((d[0] if d else {}).get('id',''))
PY
}

echo "Login admin"
api_json POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "$TMP_DIR/admin-login.json" >/dev/null
ADMIN_TOKEN="$(extract "$TMP_DIR/admin-login.json" access)"
[ -n "$ADMIN_TOKEN" ] || { echo "admin login failed" >&2; pretty "$TMP_DIR/admin-login.json"; exit 1; }

echo "UC-51 create documentation space"
api_json POST /spaces "{\"type\":\"TEAM\",\"name\":\"$SPACE_NAME\",\"key\":\"$SPACE_KEY\",\"description\":\"Documentation smoke space\"}" "$TMP_DIR/space.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/space.json"; assert_success "$TMP_DIR/space.json" "space_create"
SPACE_ID="$(extract "$TMP_DIR/space.json" id)"

echo "UC-51 list/get space"
api_json GET "/spaces" '{}' "$TMP_DIR/spaces.json" "$ADMIN_TOKEN" >/dev/null; assert_success "$TMP_DIR/spaces.json" "space_list"
api_json GET "/spaces/$SPACE_ID" '{}' "$TMP_DIR/space-get.json" "$ADMIN_TOKEN" >/dev/null; assert_success "$TMP_DIR/space-get.json" "space_get"

echo "Add editor member for collaboration baseline"
api_json POST "/spaces/$SPACE_ID/members" "{\"email\":\"$DEV_EMAIL\",\"role\":\"EDITOR\"}" "$TMP_DIR/member.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/member.json"; assert_success "$TMP_DIR/member.json" "space_member_add"

echo "UC-52 create parent page with requirements template"
api_json POST "/spaces/$SPACE_ID/pages" "{\"title\":\"Requirements $STAMP\",\"template\":\"requirements\"}" "$TMP_DIR/page.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/page.json"; assert_success "$TMP_DIR/page.json" "page_create"
PAGE_ID="$(extract "$TMP_DIR/page.json" id)"

echo "UC-52 create child page"
api_json POST "/spaces/$SPACE_ID/pages" "{\"title\":\"Child Page $STAMP\",\"parentId\":\"$PAGE_ID\",\"content\":\"<p>Child content</p>\"}" "$TMP_DIR/child.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/child.json" "child_page_create"

echo "UC-52 page tree"
api_json GET "/spaces/$SPACE_ID/pages" '{}' "$TMP_DIR/tree.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/tree.json"; assert_success "$TMP_DIR/tree.json" "page_tree"
python3 - "$TMP_DIR/tree.json" "$PAGE_ID" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); page_id=sys.argv[2]
rows=j.get('data') or []
assert any(r['id']==page_id for r in rows), rows
assert len(rows) >= 2, rows
print('page_tree_contains_parent_child=true')
PY

echo "UC-53 edit page rich text content"
RICH='<h1>Updated Requirements</h1><p>Rich text smoke content</p><ul><li>Acceptance criterion</li></ul><table><tbody><tr><td>Field</td><td>Value</td></tr></tbody></table>'
api_json PATCH "/spaces/$SPACE_ID/pages/$PAGE_ID" "{\"title\":\"Updated Requirements $STAMP\",\"content\":\"$RICH\",\"contentJson\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}}" "$TMP_DIR/page-update.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/page-update.json"; assert_success "$TMP_DIR/page-update.json" "page_rich_update"
python3 - "$TMP_DIR/page-update.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); d=j['data']
assert d['version'] >= 2, d
assert 'Rich text smoke content' in d['content'], d['content']
print('page_version_after_update=true')
PY

echo "UC-54 collaborative editing baseline"
api_json GET "/spaces/$SPACE_ID/pages/$PAGE_ID/collab/state" '{}' "$TMP_DIR/collab-state.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/collab-state.json"; assert_success "$TMP_DIR/collab-state.json" "collab_state"
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/collab/presence" '{}' "$TMP_DIR/collab-presence.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/collab-presence.json"; assert_success "$TMP_DIR/collab-presence.json" "collab_presence"
api_json POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}" "$TMP_DIR/dev-login.json" >/dev/null
DEV_TOKEN="$(extract "$TMP_DIR/dev-login.json" access)"
api_json PATCH "/spaces/$SPACE_ID/pages/$PAGE_ID" "{\"content\":\"<p>Collaborative editor update from dev1</p>\"}" "$TMP_DIR/dev-page-update.json" "$DEV_TOKEN" >/dev/null
pretty "$TMP_DIR/dev-page-update.json"; assert_success "$TMP_DIR/dev-page-update.json" "collab_dev_update"

echo "UC-55 page versioning and restore"
api_json GET "/spaces/$SPACE_ID/pages/$PAGE_ID/versions" '{}' "$TMP_DIR/versions.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/versions.json"; assert_success "$TMP_DIR/versions.json" "page_versions"
python3 - "$TMP_DIR/versions.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); rows=j.get('data') or []
assert len(rows) >= 3, rows
versions={r['version'] for r in rows}
assert 1 in versions and max(versions) >= 3, versions
print('page_versions_verified=true')
PY
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/restore/1" '{}' "$TMP_DIR/restore.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/restore.json"; assert_success "$TMP_DIR/restore.json" "page_restore"
python3 - "$TMP_DIR/restore.json" <<'PY'
import json, sys
j=json.load(open(sys.argv[1])); d=j['data']
assert d['version'] >= 4, d
assert 'Requirements' in d['content'], d['content']
print('page_restore_verified=true')
PY

echo "UC-51 to UC-55 docs smoke test passed"
