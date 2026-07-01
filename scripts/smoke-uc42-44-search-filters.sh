#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1/api}"; HOST_HEADER="${HOST_HEADER:-tms.pbos.gov.pk}"; ORIGIN="${ORIGIN:-https://tms.pbos.gov.pk}"; STAMP="$(date +%s)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pretty(){ python3 -m json.tool "$1" 2>/dev/null || cat "$1"; }
curl_json(){ local method="$1" path="$2" body="${3:-}" out="$4" token="${5:-}"; local args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Host: $HOST_HEADER" -H "Origin: $ORIGIN"); [ -n "$token" ] && args+=(-H "Authorization: Bearer $token"); [ "$method" != "GET" ] && args+=(-H 'Content-Type: application/json' -d "$body"); curl "${args[@]}"; }
extract(){ python3 - "$1" "$2" <<'PYCODE'
import json,sys
j=json.load(open(sys.argv[1])); x=j
for p in sys.argv[2].split('.'):
    x=x[int(p)] if p.isdigit() else x[p]
print(x)
PYCODE
}
LOGIN_CODE=$(curl_json POST /auth/login '{"email":"admin@acme.com","password":"Test@1234"}' "$TMP/login.json"); [ "$LOGIN_CODE" = "200" ] || { pretty "$TMP/login.json"; exit 1; }; TOKEN=$(extract "$TMP/login.json" data.tokens.accessToken)
echo "UC-42 to UC-44 setup project"; PROJECT_KEY="S${STAMP: -7}"; PROJECT_CODE=$(curl_json POST /projects "{\"name\":\"Search Smoke $STAMP\",\"key\":\"$PROJECT_KEY\",\"description\":\"Search smoke project\"}" "$TMP/project.json" "$TOKEN"); [ "$PROJECT_CODE" = "201" ] || { pretty "$TMP/project.json"; exit 1; }; PROJECT_ID=$(extract "$TMP/project.json" data.id); echo "project_create=true"
TYPES_CODE=$(curl_json GET "/projects/$PROJECT_ID/issue-types" '' "$TMP/types.json" "$TOKEN"); TYPE_ID=$(extract "$TMP/types.json" data.0.id); WF_CODE=$(curl_json GET "/projects/$PROJECT_ID/workflows" '' "$TMP/workflows.json" "$TOKEN"); STATUS_ID=$(extract "$TMP/workflows.json" data.0.statuses.0.id); MEMBERS_CODE=$(curl_json GET "/projects/$PROJECT_ID/members" '' "$TMP/members.json" "$TOKEN"); ASSIGNEE_ID=$(extract "$TMP/members.json" data.0.user.id)
UNIQUE="search-needle-$STAMP"; ISSUE_CODE=$(curl_json POST "/projects/$PROJECT_ID/issues" "{\"issueTypeId\":\"$TYPE_ID\",\"workflowStatusId\":\"$STATUS_ID\",\"title\":\"Search Smoke Issue $UNIQUE\",\"description\":\"Full text searchable smoke issue $UNIQUE\",\"priority\":\"HIGH\",\"assigneeId\":\"$ASSIGNEE_ID\",\"labels\":[\"search-smoke-$STAMP\"],\"storyPoints\":5}" "$TMP/issue.json" "$TOKEN"); [ "$ISSUE_CODE" = "201" ] || { pretty "$TMP/issue.json"; exit 1; }; ISSUE_ID=$(extract "$TMP/issue.json" data.id); echo "issue_create=true"
echo "UC-42 reindex and global search"; REINDEX_CODE=$(curl_json POST /search/reindex "{\"projectId\":\"$PROJECT_ID\"}" "$TMP/reindex.json" "$TOKEN"); [ "$REINDEX_CODE" = "200" ] || { pretty "$TMP/reindex.json"; exit 1; }; echo "search_reindex=true"
GLOBAL_CODE=$(curl_json GET "/search?q=$UNIQUE&projectId=$PROJECT_ID" '' "$TMP/global.json" "$TOKEN"); [ "$GLOBAL_CODE" = "200" ] || { pretty "$TMP/global.json"; exit 1; }
python3 - "$TMP/global.json" "$ISSUE_ID" <<'PYCODE'
import json,sys
j=json.load(open(sys.argv[1])); assert sys.argv[2] in [x.get('id') for x in j.get('data',{}).get('issues',[])], j; print('global_search_issue=true')
PYCODE
echo "UC-43 issue GUI filters"; FILTERS="{\"projectId\":\"$PROJECT_ID\",\"priority\":\"HIGH\",\"label\":\"search-smoke-$STAMP\",\"assigneeId\":\"$ASSIGNEE_ID\",\"statusId\":\"$STATUS_ID\",\"issueTypeId\":\"$TYPE_ID\"}"; ENCODED_FILTERS=$(FILTERS="$FILTERS" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["FILTERS"]))'); ISSUES_CODE=$(curl_json GET "/search/issues?q=$UNIQUE&filters=$ENCODED_FILTERS&page=1&limit=25" '' "$TMP/search-issues.json" "$TOKEN"); [ "$ISSUES_CODE" = "200" ] || { pretty "$TMP/search-issues.json"; exit 1; }
python3 - "$TMP/search-issues.json" "$ISSUE_ID" <<'PYCODE'
import json,sys
j=json.load(open(sys.argv[1])); assert sys.argv[2] in [x.get('id') for x in j.get('data',[])], j; print('gui_filters=true')
PYCODE
echo "UC-44 save/list/delete filter"; FILTER_NAME="Search Smoke Filter $STAMP"; SAVE_CODE=$(curl_json POST /search/filters/save "{\"name\":\"$FILTER_NAME\",\"projectId\":\"$PROJECT_ID\",\"filters\":$FILTERS}" "$TMP/save-filter.json" "$TOKEN"); [ "$SAVE_CODE" = "201" ] || { pretty "$TMP/save-filter.json"; exit 1; }; FILTER_ID=$(extract "$TMP/save-filter.json" data.id); echo "save_filter=true"; LIST_CODE=$(curl_json GET "/search/filters?projectId=$PROJECT_ID" '' "$TMP/list-filters.json" "$TOKEN"); [ "$LIST_CODE" = "200" ] || { pretty "$TMP/list-filters.json"; exit 1; }
python3 - "$TMP/list-filters.json" "$FILTER_ID" <<'PYCODE'
import json,sys
j=json.load(open(sys.argv[1])); assert sys.argv[2] in [x.get('id') for x in j.get('data',[])], j; print('list_saved_filter=true')
PYCODE
DELETE_CODE=$(curl_json DELETE "/search/filters/$FILTER_ID" '' "$TMP/delete-filter.json" "$TOKEN"); [ "$DELETE_CODE" = "204" ] || { echo "Delete failed HTTP $DELETE_CODE"; pretty "$TMP/delete-filter.json"; exit 1; }; echo "delete_saved_filter=true"; echo "UC-42 to UC-44 search/filter smoke test passed"
