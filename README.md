# PM Platform Monorepo

Generated from `PM_Platform_Master_Prompt.md` as an end-to-end Jira + Confluence-style project management platform.

## Repositories included

- `apps/pm-platform-db` — PostgreSQL/Prisma schema, seed, Docker services, setup scripts.
- `apps/pm-platform-api` — Express 5 REST API, JWT auth, Socket.io, BullMQ, Meilisearch, MinIO.
- `apps/pm-platform-web` — React 18/Vite frontend with Kanban, sprints, timers, performance, docs.
- `packages/shared-types` — shared API and domain TypeScript contracts.

## Local quick start

```bash
corepack enable
pnpm install
cp apps/pm-platform-db/.env.example apps/pm-platform-db/.env
cp apps/pm-platform-api/.env.example apps/pm-platform-api/.env
cp apps/pm-platform-web/.env.example apps/pm-platform-web/.env
pnpm --filter @pm-platform/db docker:up
pnpm --filter @pm-platform/db setup
pnpm dev
```

Default seed users:

- `admin@acme.com` / `Test@1234`
- `dev1@acme.com` / `Test@1234`
- `dev2@acme.com` / `Test@1234`

## Notes

The separate repo ZIP files mirror the folders under `apps/` and `packages/`. For independent Git repositories, unzip each archive and run `git init` in that directory. The API and web repos expect the DB and shared-types packages to be linked or published under the package names used in `package.json`.

<!-- TMS_USE_CASE_STATUS_START -->

## Use Case Implementation Status

This project is being implemented use-case by use-case. Each completed block is verified through smoke tests before moving to the next block.

### Status Legend

| Status | Meaning |
|---|---|
| DONE | Implemented and smoke-tested |
| DONE-RUNTIME | Verified directly in the running system |
| NEXT | Next planned implementation block |
| PLANNED | Not started yet |
| FUTURE | Later phase / roadmap item |

---

## Phase 1 — Core Platform

| UC | Use Case | Status | Verification |
|---|---|---|---|
| UC-01 | User registration | DONE | scripts/smoke-auth-uc01-03.sh |
| UC-02 | User login / logout | DONE | scripts/smoke-auth-uc01-03.sh |
| UC-03 | Token refresh | DONE | scripts/smoke-auth-uc01-03.sh |
| UC-04 | Create organisation | DONE | scripts/smoke-uc04-07-org-projects.sh |
| UC-05 | Create project | DONE | scripts/smoke-uc04-07-org-projects.sh |
| UC-06 | Invite team members | DONE | scripts/smoke-uc04-07-org-projects.sh |
| UC-07 | Assign project roles | DONE | scripts/smoke-uc04-07-org-projects.sh |
| UC-08 | Create issue | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-09 | Edit issue | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-10 | Delete issue | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-11 | Assign issue | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-12 | Create sub-task | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-13 | Link issues | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-14 | Add comment | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-15 | Attach file | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-16 | View issue history | DONE | scripts/smoke-uc08-16-issues.sh |
| UC-17 | Create custom field | DONE | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-18 | Configure issue types | DONE | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-19 | Move issue on Kanban | DONE-RUNTIME | Board transition + PostgreSQL IssueHistory verified |
| UC-20 | Create workflow | DONE | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-21 | Set transition guard | DONE | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-22 | Bulk update issues | DONE | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-23 | View notifications | DONE | scripts/smoke-uc23-24-notifications-filters.sh |
| UC-24 | Filter issue list | DONE | scripts/smoke-uc23-24-notifications-filters.sh |

### Phase 1 Result

Phase 1 UC-01 to UC-24: COMPLETE

Phase 1 includes authentication, organisation/project management, issue tracking, comments, attachments, history, workflows, Kanban movement, transition guards, notifications, filters, and bulk updates.

---

## Phase 2 — Power Features

| UC | Use Case | Status | Verification |
|---|---|---|---|
| UC-25 | Create sprint | DONE | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-26 | Start sprint | DONE | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-27 | Add issue to sprint | DONE | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-28 | Complete sprint | DONE | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-29 | View backlog | DONE | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-30 | Estimate story points | DONE | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-31 | View burndown chart | DONE | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-32 | View velocity report | DONE | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-33 | Set WIP limit | DONE | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-34 | View board swimlanes | DONE | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-35 | Log work on issue | DONE | scripts/smoke-uc35-38-time-tracking.sh |
| UC-36 | Start live timer | DONE | scripts/smoke-uc35-38-time-tracking.sh |
| UC-37 | Stop and save timer | DONE | scripts/smoke-uc35-38-time-tracking.sh |
| UC-38 | Edit worklog | DONE | scripts/smoke-uc35-38-time-tracking.sh |
| UC-39 | View individual dashboard | DONE | scripts/smoke-uc39-41-performance-reports.sh |
| UC-40 | View team dashboard | DONE | scripts/smoke-uc39-41-performance-reports.sh |
| UC-41 | Export time report | DONE | scripts/smoke-uc39-41-performance-reports.sh |
| UC-42 | Search issues | PLANNED | Feature Pack 13 |
| UC-43 | Apply GUI filters | PLANNED | Feature Pack 13 |
| UC-44 | Save filter | PLANNED | Feature Pack 13 |
| UC-45 | Receive email notification | PLANNED | Feature Pack 14 |
| UC-46 | Configure notification preferences | PLANNED | Feature Pack 14 |
| UC-47 | Configure webhook | PLANNED | Feature Pack 14 |
| UC-48 | Link GitHub commit | PLANNED | Feature Pack 14 |
| UC-49 | Manage users admin | PLANNED | Feature Pack 15 |
| UC-50 | View audit log | PLANNED | Feature Pack 15 |

### Phase 2 Current Result

Completed so far: UC-25 to UC-41  
Next block: UC-42 to UC-44

Phase 2 currently includes sprint management, backlog management, story points, burndown, velocity, WIP limits, swimlanes, worklogs, and live timers.

---

## Phase 3 — Docs, Scale & Completion

| UC | Use Case | Status | Verification |
|---|---|---|---|
| UC-51 | Create space | PLANNED | Phase 3 |
| UC-52 | Create page | PLANNED | Phase 3 |
| UC-53 | Edit page rich text | PLANNED | Phase 3 |
| UC-54 | Collaborative editing | PLANNED | Phase 3 |
| UC-55 | Page versioning | PLANNED | Phase 3 |
| UC-56 | Restrict page access | PLANNED | Phase 3 |
| UC-57 | Use page template | PLANNED | Phase 3 |
| UC-58 | Embed Jira issue in page | PLANNED | Phase 3 |
| UC-59 | Inline comment on page | PLANNED | Phase 3 |
| UC-60 | Export page to PDF | PLANNED | Phase 3 |
| UC-61 | Export page to Word | PLANNED | Phase 3 |
| UC-62 | Share page publicly | PLANNED | Phase 3 |
| UC-63 | Search across docs | PLANNED | Phase 3 |
| UC-64 | View space analytics | PLANNED | Phase 3 |
| UC-65 | Load test 500 users | FUTURE | Phase 3 hardening |
| UC-66 | Query with JQL | FUTURE | Phase 3 |
| UC-67 | JQL autocomplete | FUTURE | Phase 3 |
| UC-68 | Workflow post-function | FUTURE | Phase 3 |
| UC-69 | Create permission scheme | FUTURE | Phase 3 |
| UC-70 | Manage user groups | FUTURE | Phase 3 |
| UC-71 | View Gantt timeline | FUTURE | Phase 3 |
| UC-72 | Drag to reschedule | FUTURE | Phase 3 |
| UC-73 | SSO login | FUTURE | Phase 3 |

---

## Smoke Test Matrix

| Area | Script |
|---|---|
| Phase 1 baseline | scripts/smoke-phase1.sh |
| UC-01 to UC-03 Auth | scripts/smoke-auth-uc01-03.sh |
| UC-04 to UC-07 Org / Projects / Roles | scripts/smoke-uc04-07-org-projects.sh |
| UC-08 to UC-16 Issue Tracker | scripts/smoke-uc08-16-issues.sh |
| UC-17 to UC-22 Config / Workflow / Bulk | scripts/smoke-uc17-22-config-workflow-bulk.sh |
| UC-23 to UC-24 Notifications / Filters | scripts/smoke-uc23-24-notifications-filters.sh |
| UC-25 to UC-29 Sprints / Backlog | scripts/smoke-uc25-29-sprints-backlog.sh |
| UC-30 to UC-34 Story / Reports / Board | scripts/smoke-uc30-34-story-reports-board.sh |
| UC-35 to UC-38 Time Tracking | scripts/smoke-uc35-38-time-tracking.sh |

---

## Current Verified Milestone

Phase 1: COMPLETE  
Phase 2: UC-25 to UC-41 COMPLETE  
Next: UC-42 to UC-44 Search Issues + GUI Filters + Saved Filters

<!-- TMS_USE_CASE_STATUS_END -->
