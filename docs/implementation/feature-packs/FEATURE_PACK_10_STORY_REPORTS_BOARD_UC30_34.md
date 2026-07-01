# Feature Pack 10 — Story Points, Reports, WIP Limits, and Swimlanes

## Use cases

- UC-30 Estimate story points
- UC-31 View burndown chart
- UC-32 View velocity report
- UC-33 Set WIP limit
- UC-34 View board swimlanes

## Summary

This pack verifies and strengthens the Phase 2 agile reporting layer after sprint/backlog functionality.

## Implemented

- Story point update through issue PATCH
- Story point change persisted in IssueHistory
- Sprint burndown endpoint verified with story points
- Sprint velocity endpoint verified after sprint completion
- WIP limit update for workflow status
- WIP limit visible on board columns via WorkflowStatus.wipLimit
- Swimlane summary API for assignee, priority, label, and status grouping
- Issue list story points column
- Smoke test for UC-30 to UC-34
