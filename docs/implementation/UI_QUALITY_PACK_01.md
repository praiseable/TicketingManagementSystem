# UI Quality Pack 01 — Feedback Foundation + Dashboard + Project Settings

## Purpose

This pack addresses the first UAT-readiness gap: users were clicking buttons on Project Settings and seeing no clear response while the browser Network tab showed `400` or `404` errors. The backend was correctly rejecting invalid requests, but the frontend did not validate inputs or show useful feedback.

## Scope

- Shared API error helper
- Shared feedback banner and field error components
- Shared loading button
- Improved confirmation dialog
- Dashboard ownership/assignment visibility
- Project Settings validation and visible success/error feedback

## Screens changed

- `/dashboard`
- `/projects/:id/settings`

## Fixed behaviours

- Empty workflow name no longer sends `POST /workflows`.
- Status creation requires a selected workflow and status name.
- Status creation can no longer produce `/workflows//statuses`.
- Custom field creation requires name, key, and valid key format.
- Dropdown/multiselect custom fields require options.
- Member invite requires a valid email.
- Issue type creation requires a name.
- Transition creation requires workflow/from/to/name and prevents same From/To.
- Guard creation requires transition and required custom field for `REQUIRED_FIELD` guards.
- Member removal now uses a confirmation dialog.
- Dashboard shows ticket ownership, unassigned work, overdue tickets, and recent activity.

## Acceptance criteria

- No Project Settings button sends a known invalid empty request.
- Users see readable validation messages before submission.
- Users see success or error feedback after API calls.
- Buttons show loading state during mutations.
- Dashboard shows assigned/unassigned ticket counts.
