#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

grep -q "Log work by time interval" apps/pm-platform-web/src/components/time/WorklogForm.tsx
grep -q "Start time" apps/pm-platform-web/src/components/time/WorklogForm.tsx
grep -q "End time" apps/pm-platform-web/src/components/time/WorklogForm.tsx
! grep -q "<Label>Seconds</Label>" apps/pm-platform-web/src/components/time/WorklogForm.tsx

grep -q "Interval:" apps/pm-platform-web/src/components/time/WorklogList.tsx

grep -q "Open task details" apps/pm-platform-web/src/components/issues/IssueCard.tsx
grep -q "Drag card" apps/pm-platform-web/src/components/board/BoardCard.tsx
grep -q "to={detailPath}" apps/pm-platform-web/src/components/issues/IssueCard.tsx

grep -q "Card view" apps/pm-platform-web/src/pages/issues/IssueListPage.tsx
grep -q "List view" apps/pm-platform-web/src/pages/issues/IssueListPage.tsx
grep -q "Sub-tasks" apps/pm-platform-web/src/pages/issues/IssueListPage.tsx
grep -q "Show sub-tasks" apps/pm-platform-web/src/pages/issues/IssueListPage.tsx

echo "UI Quality Pack 02B static checks passed"
