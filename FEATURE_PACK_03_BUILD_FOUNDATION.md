# Feature Pack 03 — Build Foundation + Use Case Control

This pack prepares the repo for reliable use-case-by-use-case feature delivery.

## Scope

- Stabilizes API TypeScript build blockers caused by Express 5 route parameter typing.
- Stabilizes BullMQ/ioredis TypeScript mismatch without changing runtime connection behavior.
- Stabilizes JWT TypeScript overloads.
- Stabilizes Prisma JSON typing in page versioning.
- Fixes current web build blockers in Issue Detail/Kanban/types.
- Adds `docs/implementation/UC-IMPLEMENTATION-TRACKER.md` so the team can track UC-01 through UC-73 without missing existing functionality.
- Adds `scripts/smoke-phase1.sh` for repeatable baseline runtime checks.

## After applying

Run:

```bash
cd /home/tms/pm-platform
pnpm --filter @pm-platform/db build
pnpm --filter @pm-platform/api build
pnpm --filter @pm-platform/web build
sudo systemctl restart pm-platform-api pm-platform-web
./scripts/smoke-phase1.sh
```

If a build still fails, paste the first new error block. This pack intentionally focuses on build safety before deeper UC implementation continues.
