# Feature Pack 09 — UC-25 to UC-29 Sprint Management + Backlog

Date: 2026-06-29

## Scope

- UC-25 Create sprint
- UC-26 Start sprint
- UC-27 Add issue to sprint
- UC-28 Complete sprint
- UC-29 View backlog

## Backend

- Sprint CRUD hardening
- Sprint capacity persistence in PostgreSQL
- One active sprint per project guard
- Sprint issue association using `Issue.sprintId` and `SprintIssue`
- Complete sprint with incomplete issue carry-over
- Burndown and velocity calculations
- Backlog list, reorder, and move-to-sprint endpoints

## Frontend

- Sprint creation form
- Sprint list/detail view
- Start and complete sprint actions
- Sprint burndown and velocity charts
- Backlog table with selection and move-to-sprint action
- Scrum board grouped by status category

## Verification

Run:

```bash
./scripts/smoke-uc25-29-sprints-backlog.sh
```

Expected final line:

```text
UC-25 to UC-29 sprint/backlog smoke test passed
```
