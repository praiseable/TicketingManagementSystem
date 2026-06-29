# Feature Pack 06 — UC-08 to UC-16 Issue Tracker Depth

This pack completes the backend and smoke-test depth for the Phase 1 issue tracker use cases.

## Implemented Use Cases

- UC-08 Create issue
- UC-09 Edit issue
- UC-10 Delete issue
- UC-11 Assign issue
- UC-12 Create sub-task
- UC-13 Link issues
- UC-14 Add comment
- UC-15 Attach file
- UC-16 View issue history

## Key Files Patched

- `apps/pm-platform-api/src/schemas/index.ts`
- `apps/pm-platform-api/src/services/issue.service.ts`
- `apps/pm-platform-api/src/controllers/issues.controller.ts`
- `apps/pm-platform-web/src/api/issues.api.ts`
- `apps/pm-platform-web/src/hooks/useIssues.ts`
- `apps/pm-platform-web/src/types/index.ts`
- `scripts/smoke-uc08-16-issues.sh`

## Verify

```bash
sudo systemctl restart pm-platform-api pm-platform-web
./scripts/smoke-uc08-16-issues.sh
```
