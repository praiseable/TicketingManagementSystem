#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1/api}"
HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"
ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@acme.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test@1234}"
DEV1_EMAIL="${DEV1_EMAIL:-dev1@acme.com}"
DEV2_EMAIL="${DEV2_EMAIL:-dev2@acme.com}"
DEV_PASSWORD="${DEV_PASSWORD:-Test@1234}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
STAMP="$(date +%s)"

api_json() {
  local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"
  local args=(-sS --max-time 30 -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -o "$out" -w "%{http_code}")
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  if [ "$method" != "GET" ]; then
    [ -n "$body" ] || body="{}"
    args+=(-H "Content-Type: application/json" --data-raw "$body")
  fi
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
j=json.load(open(sys.argv[1])); e=sys.argv[2]; d=j.get('data') or {}
if e=='access': print((d.get('tokens') or {}).get('accessToken',''))
elif e=='id': print(d.get('id',''))
elif e=='share': print(d.get('shareToken',''))
elif e=='first_project': print((d[0] if d else {}).get('id',''))
elif e=='first_issue_id': print((d[0] if d else {}).get('id',''))
elif e=='first_issue_key': print((d[0] if d else {}).get('key',''))
elif e=='first_member_id': print(d.get('id',''))
elif e=='first_comment_id': print(d.get('id',''))
elif e=='first_restriction_id': print(d.get('id',''))
elif e=='pages_len': print(len(d.get('pages',[]) if isinstance(d,dict) else []))
PY
}

login() {
  local email="$1" pass="$2" out="$3"
  api_json POST /auth/login "{\"email\":\"$email\",\"password\":\"$pass\"}" "$out" >/dev/null
  assert_success "$out" "login_${email//@/-}" >/dev/null
  extract "$out" access
}

echo "Login users"
ADMIN_TOKEN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$TMP_DIR/admin-login.json")"
DEV1_TOKEN="$(login "$DEV1_EMAIL" "$DEV_PASSWORD" "$TMP_DIR/dev1-login.json")"
DEV2_TOKEN="$(login "$DEV2_EMAIL" "$DEV_PASSWORD" "$TMP_DIR/dev2-login.json")"
[ -n "$ADMIN_TOKEN" ] && [ -n "$DEV1_TOKEN" ] && [ -n "$DEV2_TOKEN" ]
echo "login_users=true"

echo "UC-51/UC-57 create space and template page"
SPACE_KEY="DA${STAMP: -6}"
api_json POST /spaces "{\"type\":\"TEAM\",\"name\":\"Docs Advanced $STAMP\",\"key\":\"$SPACE_KEY\",\"description\":\"UC56-64 smoke\"}" "$TMP_DIR/space.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/space.json"; assert_success "$TMP_DIR/space.json" "space_create"
SPACE_ID="$(extract "$TMP_DIR/space.json" id)"
api_json GET /spaces/templates '{}' "$TMP_DIR/templates.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/templates.json"; assert_success "$TMP_DIR/templates.json" "templates_list"

api_json POST "/spaces/$SPACE_ID/members" "{\"email\":\"$DEV1_EMAIL\",\"role\":\"EDITOR\"}" "$TMP_DIR/member-dev1.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/member-dev1.json" "member_dev1_editor"
DEV1_MEMBER_ID="$(extract "$TMP_DIR/member-dev1.json" first_member_id)"
api_json POST "/spaces/$SPACE_ID/members" "{\"email\":\"$DEV2_EMAIL\",\"role\":\"VIEWER\"}" "$TMP_DIR/member-dev2.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/member-dev2.json" "member_dev2_viewer"

UNIQUE="docs-advanced-$STAMP"
api_json POST "/spaces/$SPACE_ID/pages" "{\"title\":\"Advanced Docs $STAMP\",\"template\":\"requirements\",\"content\":\"<h1>$UNIQUE</h1><p>Restrictions, comments, exports, share, analytics.</p>\"}" "$TMP_DIR/page.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/page.json"; assert_success "$TMP_DIR/page.json" "template_page_create"
PAGE_ID="$(extract "$TMP_DIR/page.json" id)"

api_json POST "/spaces/$SPACE_ID/pages" "{\"title\":\"Meeting Template $STAMP\",\"template\":\"meeting\"}" "$TMP_DIR/template-page.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/template-page.json" "template_meeting_page_create"

echo "UC-56 restrict page access"
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/restrictions" "{\"type\":\"VIEW\",\"userId\":\"$(python3 - "$TMP_DIR/member-dev1.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); print(j['data']['user']['id'])
PY
)\"}" "$TMP_DIR/restrict.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/restrict.json"; assert_success "$TMP_DIR/restrict.json" "page_restriction_create"
RESTRICTION_ID="$(extract "$TMP_DIR/restrict.json" first_restriction_id)"
api_json GET "/spaces/$SPACE_ID/pages/$PAGE_ID" '{}' "$TMP_DIR/dev1-page.json" "$DEV1_TOKEN" >/dev/null
assert_success "$TMP_DIR/dev1-page.json" "restriction_allows_named_user"
HTTP_CODE="$(api_json GET "/spaces/$SPACE_ID/pages/$PAGE_ID" '{}' "$TMP_DIR/dev2-page.json" "$DEV2_TOKEN")"
[ "$HTTP_CODE" = "403" ] || { echo "Expected dev2 restricted HTTP 403 but got $HTTP_CODE" >&2; pretty "$TMP_DIR/dev2-page.json"; exit 1; }
echo "restriction_blocks_other_viewer=true"
api_json DELETE "/spaces/$SPACE_ID/pages/$PAGE_ID/restrictions/$RESTRICTION_ID" '{}' "$TMP_DIR/delete-restrict.json" "$ADMIN_TOKEN" >/dev/null || true

echo "UC-58 embed Jira issue"
api_json GET /projects '{}' "$TMP_DIR/projects.json" "$ADMIN_TOKEN" >/dev/null
PROJECT_ID="$(extract "$TMP_DIR/projects.json" first_project)"
api_json GET "/projects/$PROJECT_ID/issues?limit=1" '{}' "$TMP_DIR/issues.json" "$ADMIN_TOKEN" >/dev/null
ISSUE_ID="$(extract "$TMP_DIR/issues.json" first_issue_id)"; ISSUE_KEY="$(extract "$TMP_DIR/issues.json" first_issue_key)"
[ -n "$ISSUE_ID" ] && [ -n "$ISSUE_KEY" ] || { echo "No issue available to embed" >&2; pretty "$TMP_DIR/issues.json"; exit 1; }
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/embed-issue" "{\"issueKey\":\"$ISSUE_KEY\"}" "$TMP_DIR/embed.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/embed.json"; assert_success "$TMP_DIR/embed.json" "issue_embed"

echo "UC-59 inline page comment"
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/comments" "{\"body\":\"Inline comment for $UNIQUE\",\"selectionStart\":1,\"selectionEnd\":12}" "$TMP_DIR/comment.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/comment.json"; assert_success "$TMP_DIR/comment.json" "inline_comment_create"
COMMENT_ID="$(extract "$TMP_DIR/comment.json" first_comment_id)"
api_json PATCH "/spaces/$SPACE_ID/pages/$PAGE_ID/comments/$COMMENT_ID/resolve" '{}' "$TMP_DIR/comment-resolve.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/comment-resolve.json" "inline_comment_resolve"

echo "UC-60/UC-61 exports"
PDF_CODE="$(curl -sS --max-time 45 -X POST "$BASE_URL/spaces/$SPACE_ID/pages/$PAGE_ID/export/pdf" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -H "Authorization: Bearer $ADMIN_TOKEN" -o "$TMP_DIR/page.pdf" -w "%{http_code}")"
[ "$PDF_CODE" = "200" ] && [ -s "$TMP_DIR/page.pdf" ] || { echo "PDF export failed: $PDF_CODE" >&2; exit 1; }
echo "pdf_export=true"
DOCX_CODE="$(curl -sS --max-time 45 -X POST "$BASE_URL/spaces/$SPACE_ID/pages/$PAGE_ID/export/docx" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -H "Authorization: Bearer $ADMIN_TOKEN" -o "$TMP_DIR/page.docx" -w "%{http_code}")"
[ "$DOCX_CODE" = "200" ] && [ -s "$TMP_DIR/page.docx" ] || { echo "DOCX export failed: $DOCX_CODE" >&2; exit 1; }
echo "docx_export=true"

echo "UC-62 public share"
api_json POST "/spaces/$SPACE_ID/pages/$PAGE_ID/share" '{}' "$TMP_DIR/share.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/share.json"; assert_success "$TMP_DIR/share.json" "page_share"
SHARE_TOKEN="$(extract "$TMP_DIR/share.json" share)"
[ -n "$SHARE_TOKEN" ] || { echo "share token empty" >&2; exit 1; }
SHARED_CODE="$(curl -sS --max-time 25 -X GET "$BASE_URL/spaces/shared/$SHARE_TOKEN" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN" -o "$TMP_DIR/shared.json" -w "%{http_code}")"
[ "$SHARED_CODE" = "200" ] || { echo "shared page failed HTTP $SHARED_CODE" >&2; pretty "$TMP_DIR/shared.json"; exit 1; }
pretty "$TMP_DIR/shared.json"; assert_success "$TMP_DIR/shared.json" "public_share_get"

echo "UC-63 docs search"
api_json POST /search/reindex "{\"projectId\":null}" "$TMP_DIR/reindex.json" "$ADMIN_TOKEN" >/dev/null
assert_success "$TMP_DIR/reindex.json" "search_reindex"
api_json GET "/search?q=$UNIQUE" '{}' "$TMP_DIR/search.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/search.json"; assert_success "$TMP_DIR/search.json" "docs_search"
python3 - "$TMP_DIR/search.json" "$PAGE_ID" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); page_id=sys.argv[2]
pages=(j.get('data') or {}).get('pages') or []
assert any(p.get('id')==page_id for p in pages), j
print('docs_search_page_found=true')
PY

echo "UC-64 space analytics"
api_json GET "/spaces/$SPACE_ID/analytics" '{}' "$TMP_DIR/analytics.json" "$ADMIN_TOKEN" >/dev/null
pretty "$TMP_DIR/analytics.json"; assert_success "$TMP_DIR/analytics.json" "space_analytics"
python3 - "$TMP_DIR/analytics.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); d=j.get('data') or {}
assert d.get('pages',0) >= 2, d
assert d.get('comments',0) >= 1, d
assert d.get('versions',0) >= 1, d
print('space_analytics_verified=true')
PY

echo "UC-56 to UC-64 docs advanced smoke test passed"
