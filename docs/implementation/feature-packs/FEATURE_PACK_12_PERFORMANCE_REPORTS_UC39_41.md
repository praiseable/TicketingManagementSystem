# Feature Pack 12 — UC-39 to UC-41 Performance Dashboards and Time Reports

## Scope

- UC-39 View individual dashboard
- UC-40 View team dashboard
- UC-41 Export time report

## Backend

- Added live individual performance calculation from issues and worklogs.
- Added team performance dashboard by project members.
- Added grouped time report by user/project/issue/issue type/day.
- Added CSV export honoring the same filters.
- Preserved PerformanceSnapshot aggregation support.

## Frontend

- Rebuilt My Performance page around live metrics.
- Rebuilt Team Performance page with project selector and team table.
- Rebuilt Time Report page with grouping, date filters and CSV export.

## Smoke test

```bash
./scripts/smoke-uc39-41-performance-reports.sh
```

Expected:

```text
UC-39 to UC-41 performance/report smoke test passed
```
