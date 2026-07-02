#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/pm-platform-web/src"

echo "UI Quality Pack 01 static checks"

check_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then
    echo "$label=true"
  else
    echo "$label=false" >&2
    echo "Missing pattern '$pattern' in $file" >&2
    exit 1
  fi
}

check_absent() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then
    echo "$label=false" >&2
    echo "Unexpected pattern '$pattern' in $file" >&2
    exit 1
  else
    echo "$label=true"
  fi
}

check_contains "$WEB/lib/api-error.ts" "getApiErrorMessage" "api_error_helper"
check_contains "$WEB/components/common/Feedback.tsx" "role=\{tone === 'error'" "feedback_component"
check_contains "$WEB/components/common/LoadingButton.tsx" "aria-busy" "loading_button"
check_contains "$WEB/components/common/ConfirmDialog.tsx" "description" "confirm_dialog_description"

check_contains "$WEB/pages/dashboard/DashboardPage.tsx" "Tickets by assignee" "dashboard_assignee_section"
check_contains "$WEB/pages/dashboard/DashboardPage.tsx" "Unassigned" "dashboard_unassigned_metric"
check_contains "$WEB/pages/dashboard/DashboardPage.tsx" "Recent active tickets" "dashboard_recent_tickets"

SETTINGS="$WEB/pages/projects/ProjectSettingsPage.tsx"
check_contains "$SETTINGS" "Email address is required" "member_email_required_validation"
check_contains "$SETTINGS" "Enter a valid email address" "member_email_format_validation"
check_contains "$SETTINGS" "Field key is required" "custom_field_key_validation"
check_contains "$SETTINGS" "Options are required" "custom_field_options_validation"
check_contains "$SETTINGS" "Workflow name is required" "workflow_name_validation"
check_contains "$SETTINGS" "Select a workflow first" "workflow_selection_validation"
check_contains "$SETTINGS" "From and To statuses cannot be the same" "transition_same_status_validation"
check_contains "$SETTINGS" "Select a transition first" "guard_transition_validation"
check_contains "$SETTINGS" "ConfirmDialog" "member_remove_confirmation"
check_contains "$SETTINGS" "LoadingButton" "settings_loading_buttons"
check_absent "$SETTINGS" "workflows//statuses" "no_double_slash_workflow_url_literal"

if [ -f "$ROOT/docs/test-cases/UI_QUALITY_PACK_01_TEST_CASES.md" ]; then
  echo "test_cases_doc=true"
else
  echo "test_cases_doc=false" >&2
  exit 1
fi

echo "UI Quality Pack 01 static checks passed"
