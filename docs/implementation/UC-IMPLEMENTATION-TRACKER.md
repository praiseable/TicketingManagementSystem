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

## Checkpoint — UC-04 to UC-07 Organization / Project / Member Completion

Status:

- UC-04 Create/manage organisation baseline: DONE-RUNTIME
- UC-05 Create project with default issue types and workflow: DONE-RUNTIME
- UC-06 Invite team members / add existing org users: DONE-RUNTIME
- UC-07 Assign project roles and remove members with owner protection: DONE-RUNTIME

Verified through:

- scripts/smoke-uc04-07-org-projects.sh
- Project list create-project UI
- Project settings general/member/workflow UI

## Checkpoint — UC-04 to UC-07 Organization / Project / Member Completion

Status:

- UC-04 Create/manage organisation baseline: DONE-RUNTIME
- UC-05 Create project with default issue types and workflow: DONE-RUNTIME
- UC-06 Invite team members / add existing org users: DONE-RUNTIME
- UC-07 Assign project roles and remove members with owner protection: DONE-RUNTIME

Verified through:

- scripts/smoke-uc04-07-org-projects.sh
- Project list create-project UI
- Project settings general/member/workflow UI

## Checkpoint — UC-04 to UC-07 Organization / Project / Member Completion

Date: 2026-06-29

Status:

- UC-04 Create/manage organisation: DONE
- UC-05 Create project with default issue types and workflow: DONE
- UC-06 Invite team members: DONE
- UC-07 Assign/change project roles: DONE
- UC-07 Remove project member: DONE

Verified through:

- scripts/smoke-uc04-07-org-projects.sh

Smoke evidence:

- Organization get/update returned success=true
- Project created with 3 issue types and 5 workflow statuses
- dev1@acme.com invited and added as project member
- dev1@acme.com role changed from MEMBER to ADMIN
- dev1@acme.com removed from project

## Feature Pack 06 — UC-08 to UC-16 Issue Tracker Depth

Status: IMPLEMENTED-PENDING-SMOKE

Scope:

- UC-08 Create issue with issue type, title, description, priority, assignee, labels, estimates, due date, and custom field values
- UC-09 Edit issue with automatic IssueHistory changelog rows
- UC-10 Delete issue and cascade sub-tasks
- UC-11 Assign issue and emit assignment notification
- UC-12 Create sub-task via parentId
- UC-13 Link issues by key or ID
- UC-14 Add comment with @email mention notification
- UC-15 Upload attachment through MinIO and return presigned URL
- UC-16 View issue history / changelog

Verification:

```bash
./scripts/smoke-uc08-16-issues.sh
```

## Hotfix — UC-15 Attachment Upload Stabilization

Status: APPLIED

Changes:

- Attachment API serializes BigInt `sizeBytes` safely.
- Attachment list/create responses include uploader summary.
- Attachment create writes IssueHistory entry `attachment.added`.
- Attachment delete removes MinIO object, deletes DB record, and writes `attachment.removed` history.
- Storage service checks/creates MinIO bucket and returns clear storage errors.
- Smoke script prints attachment response body when upload fails.

## Checkpoint — UC-08 to UC-16 Issue Tracker Completion

Date: 2026-06-29

Status:

- UC-08 Create issue with type, fields, priority, labels, custom field values: DONE
- UC-09 Edit issue and write changelog/history: DONE
- UC-10 Delete issue and cascade sub-task: DONE
- UC-11 Assign issue and trigger notification path: DONE
- UC-12 Create sub-task using parent issue: DONE
- UC-13 Link issues by relationship type: DONE
- UC-14 Add comment with @mention notification: DONE
- UC-15 Attach file through MinIO and return presigned URL: DONE
- UC-16 View full issue history/changelog: DONE

Verified through:

- scripts/smoke-uc08-16-issues.sh

Smoke evidence:

- Issue created with custom field values, labels, priority, estimates, and due date
- Issue update wrote history for title, description, priority, assignee, and labels
- Sub-task created and deleted with parent
- Issue link created
- Comment created with @dev1@acme.com mention
- Mention notification count verified in database
- File uploaded to MinIO and presigned URL generated
- Full detail and history verified
- Parent issue delete returned 204
- Deleted parent and subtask returned 404

## Checkpoint — UC-08 to UC-16 Issue Tracker Completion

Date: 2026-06-29

Status:

- UC-08 Create issue with type, fields, priority, labels, custom field values: DONE
- UC-09 Edit issue and write changelog/history: DONE
- UC-10 Delete issue and cascade sub-task: DONE
- UC-11 Assign issue and trigger notification path: DONE
- UC-12 Create sub-task using parent issue: DONE
- UC-13 Link issues by relationship type: DONE
- UC-14 Add comment with @mention notification: DONE
- UC-15 Attach file through MinIO and return presigned URL: DONE
- UC-16 View full issue history/changelog: DONE

Verified through:

- scripts/smoke-uc08-16-issues.sh
- Full regression run on 2026-06-29

Smoke evidence:

- Issue created with custom field values, labels, priority, estimates, and due date
- Issue update wrote history for title, description, priority, assignee, and labels
- Sub-task created and deleted with parent
- Issue link created
- Comment created with @dev1@acme.com mention
- Mention notification count verified in database
- File uploaded to MinIO and presigned URL generated
- Full detail and history verified
- Parent issue delete returned 204
- Deleted parent and subtask returned 404

## Feature Pack 07 — UC-17 to UC-22 Configuration / Workflow / Bulk Actions

Status: APPLIED, pending smoke verification

Scope:

- UC-17 Create custom field
- UC-18 Configure issue types
- UC-20 Create workflow
- UC-21 Set transition guard
- UC-22 Bulk update issues

Verification script:

```bash
./scripts/smoke-uc17-22-config-workflow-bulk.sh
```

## Checkpoint — UC-17 to UC-22 Configuration / Workflow / Bulk Completion

Date: 2026-06-29

Status:

- UC-17 Create custom field: DONE
- UC-18 Configure issue types: DONE
- UC-20 Create workflow: DONE
- UC-21 Set transition guard: DONE
- UC-22 Bulk update issues: DONE

Verified through:

- scripts/smoke-uc17-22-config-workflow-bulk.sh

Smoke evidence:

- Custom field created successfully
- Issue type created and linked with custom field layout
- Workflow created successfully
- Workflow statuses created successfully
- Workflow transition created successfully
- Required-field transition guard created successfully
- Guard correctly blocked transition when required custom field was empty
- Guard allowed transition after required custom field value was filled
- Bulk priority update completed successfully
- Bulk label update completed successfully

## Checkpoint — UC-23 to UC-24 Notifications and Issue Filters

Date: 2026-06-29

Status after applying Feature Pack 08:

- UC-23 View notifications: IMPLEMENTED
- UC-23 Mark notification read: IMPLEMENTED
- UC-23 Mark all notifications read: IMPLEMENTED
- UC-23 Notification preferences: IMPLEMENTED
- UC-24 Filter issue list by search/status/type/priority/label/date range: IMPLEMENTED
- UC-24 Save filter: IMPLEMENTED
- UC-24 List saved filters: IMPLEMENTED
- UC-24 Delete saved filter: IMPLEMENTED

Verification script:

- scripts/smoke-uc23-24-notifications-filters.sh

## Checkpoint — UC-23 to UC-24 Notifications / Issue Filters Completion

Date: 2026-06-29

Status:

- UC-23 View notifications: DONE
- UC-23 Mark single notification as read: DONE
- UC-23 Mark all notifications as read: DONE
- UC-23 Notification preferences baseline: DONE
- UC-24 Filter issue list by type/status/assignee/priority/label/sprint/search/date: DONE
- UC-24 Saved filter baseline: DONE

Verified through:

- scripts/smoke-uc23-24-notifications-filters.sh

Smoke evidence:

- Notification list returned success=true
- Unread notification metadata returned
- Single notification marked read
- Mark all read completed
- Notification preferences loaded/updated
- Issue filters returned correct filtered results
- Saved filter create/list/delete flow verified


## Feature Pack 09 — UC-25 to UC-29 Sprint / Backlog Implementation

Date: 2026-06-29

Status after applying pack:

- UC-25 Create sprint: implemented, smoke pending
- UC-26 Start sprint: implemented, smoke pending
- UC-27 Add issue to sprint: implemented, smoke pending
- UC-28 Complete sprint: implemented, smoke pending
- UC-29 View backlog: implemented, smoke pending

Verification script:

- scripts/smoke-uc25-29-sprints-backlog.sh

## Checkpoint — UC-25 to UC-29 Sprint / Backlog Completion

Date: 2026-06-30

Status:

- UC-25 Create sprint: DONE
- UC-26 Start sprint: DONE
- UC-27 Add issue to sprint: DONE
- UC-28 Complete sprint: DONE
- UC-29 View backlog: DONE

Verified through:

- scripts/smoke-uc25-29-sprints-backlog.sh

Smoke evidence:

- Project created for sprint/backlog smoke test
- Backlog issues created successfully
- Sprint created with capacity
- Backlog returned expected unsprinted issues
- Selected issues moved from backlog to sprint
- Sprint started successfully
- Single active sprint guard verified
- One issue transitioned to Done before completion
- Sprint completed successfully
- Completed issue counted correctly
- Incomplete issues moved to next sprint
- Burndown endpoint returned data
- Velocity endpoint returned data

## Feature Pack 10 — UC-30 to UC-34 Story / Reporting / Board

Status: IMPLEMENTED — awaiting smoke verification

Use cases:

- UC-30 Estimate story points
- UC-31 View burndown chart
- UC-32 View velocity report
- UC-33 Set WIP limit
- UC-34 View board swimlanes

Verification script:

- scripts/smoke-uc30-34-story-reports-board.sh

## Checkpoint — UC-30 to UC-34 Story Points / Reports / Board Completion

Date: 2026-06-30

Status:

- UC-30 Estimate story points: DONE
- UC-31 View burndown chart: DONE
- UC-32 View velocity report: DONE
- UC-33 Set WIP limit: DONE
- UC-34 View board swimlanes: DONE

Verified through:

- scripts/smoke-uc30-34-story-reports-board.sh

Smoke evidence:

- Story points updated successfully
- Story point change wrote issue history
- WIP limit updated and persisted
- Sprint reporting data prepared successfully
- Burndown endpoint returned chart data
- Velocity endpoint returned chart data
- Swimlane summary by assignee returned data
- Swimlane summary by priority returned data
- Swimlane summary by label returned data
- Swimlane summary by status returned data

## Checkpoint — UC-35 to UC-38 Time Tracking Completion

Date: pending smoke verification

Status:

- UC-35 Log work on issue: IMPLEMENTED, PENDING SMOKE
- UC-36 Start live timer: IMPLEMENTED, PENDING SMOKE
- UC-37 Stop and save timer: IMPLEMENTED, PENDING SMOKE
- UC-38 Edit worklog: IMPLEMENTED, PENDING SMOKE

Verification script:

- scripts/smoke-uc35-38-time-tracking.sh
