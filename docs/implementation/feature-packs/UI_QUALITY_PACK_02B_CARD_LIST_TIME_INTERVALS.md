# UI Quality Pack 02B — Worklog Intervals + Card/List Task Views

## Purpose

This pack improves task usability after UI Quality Pack 02. It addresses two UAT findings:

1. Worklogs should be entered as a time interval, not raw seconds.
2. Tasks should support both card view and Jira-style list view with expandable subtasks.

## Changes

- Worklog form now uses Start time and End time.
- Duration is calculated automatically and displayed in hours/minutes.
- Worklog list displays the interval and human duration.
- Board card title/description/body opens the issue detail page.
- Board dragging uses a visible drag handle to avoid accidental drag while clicking text.
- Issue list now supports Card view and List view.
- List view supports +/chevron expansion to show subtasks inline.

## Verification

Run:

```bash
./scripts/smoke-ui-quality-pack-02b.sh
```

Expected:

```text
UI Quality Pack 02B static checks passed
```
