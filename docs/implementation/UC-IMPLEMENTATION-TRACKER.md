# PM Platform Use Case Implementation Tracker

This tracker is the working implementation control document. Feature packs must update this file whenever a use case changes state.

Status legend:

- `DONE-RUNTIME` — confirmed working in the current single-server dev runtime.
- `PARTIAL` — code exists but not complete end-to-end.
- `PLANNED` — not yet implemented or needs depth.
- `BLOCKED-BUILD` — blocked by TypeScript/build stabilization.

## Current deployment assumption

```text
Domain: https://tms.pbos.gov.pk
Server: 10.10.4.102
Runtime: systemd + pnpm dev
Frontend: 127.0.0.1:5173
API: 127.0.0.1:3001
PostgreSQL: 127.0.0.1:55432
Reverse proxy: Nginx Proxy Manager -> Ubuntu Nginx -> Vite/API
```

## Phase 1 — Core Platform

| UC | Name | Current state | Notes / next work |
|---|---|---|---|
| UC-01 | User registration | PARTIAL | API exists; needs email verification/onboarding polish. |
| UC-02 | User login / logout | DONE-RUNTIME | Login confirmed; logout route exists. Needs automated smoke coverage. |
| UC-03 | Token refresh | PARTIAL | API/client refresh exists; needs expiration regression test. |
| UC-04 | Create organisation | PARTIAL | Registration creates org; dedicated org admin UI incomplete. |
| UC-05 | Create project | PARTIAL | API exists; project create UI needs validation/depth. |
| UC-06 | Invite team members | PARTIAL | API exists; email/invite acceptance flow incomplete. |
| UC-07 | Assign project roles | PARTIAL | API exists; project members UI incomplete. |
| UC-08 | Create issue | PARTIAL | Board issue modal exists; full custom fields incomplete. |
| UC-09 | Edit issue | PARTIAL | Issue detail inline edit exists; needs runtime QA and build clean. |
| UC-10 | Delete issue | PARTIAL | API/client hook exists; UI confirmation incomplete. |
| UC-11 | Assign issue | PARTIAL | Assignment update works; notification/email needs depth. |
| UC-12 | Create sub-task | PARTIAL | UI/API scaffold exists; needs QA. |
| UC-13 | Link issues | PARTIAL | UI/API scaffold exists; needs validation and edge cases. |
| UC-14 | Add comment | PARTIAL | Comment create/edit/delete exists; mention parsing/notification depth needed. |
| UC-15 | Attach file | PARTIAL | Upload/download path exists; MinIO preview/delete QA needed. |
| UC-16 | View issue history | PARTIAL | Workflow transition history confirmed; all field changes need coverage. |
| UC-17 | Create custom field | PLANNED | DB/API exists; admin UI incomplete. |
| UC-18 | Configure issue types | PLANNED | DB/API exists; admin UI incomplete. |
| UC-19 | Move issue on Kanban | DONE-RUNTIME | Cards load and transitions persist in IssueHistory. Smooth UI polish ongoing. |
| UC-20 | Create workflow | PARTIAL | API exists; workflow builder UI incomplete. |
| UC-21 | Set transition guard | PLANNED | DB/API scaffold exists; guard UI/execution depth needed. |
| UC-22 | Bulk update issues | PARTIAL | API scaffold exists; UI incomplete. |
| UC-23 | View notifications | PARTIAL | Endpoint fixed; bell/prefs/actions need depth. |
| UC-24 | Filter issue list | PARTIAL | Basic query path exists; GUI saved filters incomplete. |

## Phase 2 — Power Features

| UC range | Name | Current state | Notes |
|---|---|---|---|
| UC-25–30 | Sprint/backlog planning | PARTIAL | API exists; backlog/sprint UI depth needed. |
| UC-31–34 | Agile reports and board enhancements | PARTIAL | Basic charts/components exist; needs real data, WIP UI settings, swimlane QA. |
| UC-35–38 | Time tracking and live timer | PARTIAL | Worklogs/timer scaffold exists; needs full issue-detail QA. |
| UC-39–41 | Performance and time reports | PARTIAL | Some live data patch exists; CSV/report depth needed. |
| UC-42–44 | Search and filters | PARTIAL | Search UI/API exists; Meilisearch indexing/saved filter depth needed. |
| UC-45–48 | Email/webhooks/GitHub | PLANNED | Queues/webhook scaffold exists; email delivery and GitHub parser incomplete. |
| UC-49–50 | Admin users/audit | PARTIAL | Read/list exists; real actions and audit detail incomplete. |

## Phase 3 — Docs, Scale & Completion

| UC range | Name | Current state | Notes |
|---|---|---|---|
| UC-51–58 | Spaces/pages/editor/issue embed | PARTIAL | Basic docs pages/editor exist; collaborative/edit macro depth incomplete. |
| UC-59–64 | Inline comments/export/share/search/analytics | PARTIAL | Export/share/search scaffold exists; persistence/formatting incomplete. |
| UC-65 | Load test 500 users | PLANNED | k6 suite missing. |
| UC-66–67 | JQL query/autocomplete | PLANNED | Not implemented end-to-end. |
| UC-68–70 | Workflow post-functions/permissions/groups | PLANNED | DB scaffolds partly available; UI/service depth missing. |
| UC-71–72 | Gantt/roadmap | PLANNED | Not implemented. |
| UC-73 | SSO login | PLANNED | SAML/SSO foundation missing. |

## Feature Pack 04 — Auth UC-01 to UC-03

| UC | Title | Status | Notes |
|---|---|---|---|
| UC-01 | User registration | DONE-RUNTIME | Registration creates org, user, email verification token, notification preferences, auth session, and dev-safe email log when SMTP is not configured. |
| UC-02 | User login / logout | DONE-RUNTIME | Login updates lastLoginAt, issues JWT token pair, logout revokes refresh token. |
| UC-03 | Token refresh | DONE-RUNTIME | Refresh token is rotated and stored hashed; old/raw tokens are handled backwards-compatibly. |

## Checkpoint — UC-01 to UC-03 Auth Completion

Date: 2026-06-29

Status:

- UC-01 User registration: DONE
- UC-01 Email verification: DONE
- UC-01 Forgot password: DONE
- UC-01 Reset password: DONE
- UC-02 Login: DONE
- UC-02 /auth/me: DONE
- UC-02 Logout: DONE
- UC-03 Refresh token rotation: DONE
- UC-03 Refresh token revocation after logout: DONE

Verified through:

- scripts/smoke-auth-uc01-03.sh
- Manual reset-password API test
- Manual login with new password test
