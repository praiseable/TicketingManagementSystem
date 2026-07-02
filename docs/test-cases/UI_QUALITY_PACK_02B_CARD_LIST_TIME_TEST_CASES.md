# UI Quality Pack 02B Test Cases — Worklog Intervals + Task Card/List Views

## UQ2B-01 Worklog interval entry
1. Open an issue detail page.
2. Click **Log work**.
3. Verify the form shows **Start time** and **End time** instead of raw seconds.
4. Set end time after start time.
5. Verify calculated duration appears as minutes/hours.
6. Save worklog.

Expected: Worklog saves successfully and list displays interval like `09:00 → 10:30` with duration like `1h 30m`.

## UQ2B-02 Invalid worklog interval
1. Open Log work.
2. Set end time before start time.
3. Submit.

Expected: No API call should be sent; UI shows `End time must be after start time`.

## UQ2B-03 Board card click opens detail
1. Open Kanban board.
2. Click the issue title or description text on a card.

Expected: Full issue detail page opens.

## UQ2B-04 Board drag still works
1. Open Kanban board.
2. Drag card using the small grip handle.

Expected: Card moves normally. Clicking title/description does not start drag.

## UQ2B-05 Issue list view toggle
1. Open project Issues page.
2. Click **List view**.
3. Click **Card view**.

Expected: User can switch between card layout and Jira-style task list.

## UQ2B-06 Subtask expansion
1. Open Issues page in List view.
2. Click the +/chevron button on a task row.

Expected: Subtasks appear inline below the parent task. If none exist, an explanatory empty state appears.
