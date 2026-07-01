# Feature Pack 11 — UC-35 to UC-38 Time Tracking + Live Timer

## Scope

- UC-35 Log work on issue
- UC-36 Start live timer
- UC-37 Stop and save timer
- UC-38 Edit worklog

## Backend changes

- Worklog create/update/delete now writes `IssueHistory` entries.
- Remaining estimate is recalculated from `originalEstimate - sum(worklogs)`.
- Timer start supports resume from paused state.
- Timer pause stores accumulated seconds in Redis and PostgreSQL.
- Timer stop creates a Worklog, removes the Redis timer, deletes TimerSession, and writes history.
- Active timers include issue key/title data for topbar display.

## Frontend changes

- Worklog form supports create and edit modes.
- Worklog list supports edit and delete actions.
- Live timer supports start, pause, resume, stop-and-save.
- Topbar shows active timer with issue key.

## Verification

Run:

```bash
./scripts/smoke-uc35-38-time-tracking.sh
```

Expected:

```text
UC-35 to UC-38 time tracking smoke test passed
```
