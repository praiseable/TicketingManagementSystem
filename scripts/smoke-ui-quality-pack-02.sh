#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
check_file() { [ -f "$1" ] || { echo "Missing $1" >&2; exit 1; }; }
check_text() { grep -qE "$2" "$1" || { echo "Missing pattern '$2' in $1" >&2; exit 1; }; }
check_file apps/pm-platform-web/src/components/issues/AttachmentUpload.tsx
check_file apps/pm-platform-web/src/components/issues/SubTaskList.tsx
check_file apps/pm-platform-web/src/components/issues/IssueLinks.tsx
check_file apps/pm-platform-web/src/components/time/WorklogForm.tsx
check_file apps/pm-platform-web/src/components/time/WorklogList.tsx
check_file apps/pm-platform-web/src/components/time/LiveTimer.tsx
check_file apps/pm-platform-web/src/pages/backlog/BacklogPage.tsx
check_file apps/pm-platform-web/src/pages/sprints/SprintsPage.tsx
check_file docs/test-cases/UI_QUALITY_PACK_02_TEST_CASES.md
check_text apps/pm-platform-web/src/components/issues/AttachmentUpload.tsx "Upload failed|Delete attachment|File too large"
check_text apps/pm-platform-web/src/components/issues/SubTaskList.tsx "Sub-task title is required"
check_text apps/pm-platform-web/src/components/issues/IssueLinks.tsx "Target issue key or ID is required|Remove issue link"
check_text apps/pm-platform-web/src/components/time/WorklogForm.tsx "Time spent must be greater than zero"
check_text apps/pm-platform-web/src/components/time/WorklogList.tsx "Delete worklog\?"
check_text apps/pm-platform-web/src/components/time/LiveTimer.tsx "Timer action failed"
check_text apps/pm-platform-web/src/pages/backlog/BacklogPage.tsx "Choose a sprint before moving issues"
check_text apps/pm-platform-web/src/pages/sprints/SprintsPage.tsx "Sprint name is required|Complete sprint\?"
check_text docs/test-cases/UI_QUALITY_PACK_02_TEST_CASES.md "UI02-ID-01|UI02-SP-02|UI02-TM-03"
echo "UI Quality Pack 02 static checks passed"

grep -q "Open task details" apps/pm-platform-web/src/components/issues/IssueCard.tsx
grep -q "Drag card" apps/pm-platform-web/src/components/board/BoardCard.tsx
grep -q "to={detailPath}" apps/pm-platform-web/src/components/issues/IssueCard.tsx

echo "ui_pack_02_card_click_details=true"
