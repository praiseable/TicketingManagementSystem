# UI Quality Pack 01 Test Cases

## Test Setup

- Login as `admin@acme.com`.
- Open `https://tms.pbos.gov.pk/dashboard`.
- Open a project settings page: `https://tms.pbos.gov.pk/projects/<projectId>/settings`.
- Open browser DevTools Network tab only to confirm invalid requests are prevented.

---

## Dashboard Tests

### UQ01-DASH-001 — Dashboard shows ticket ownership

**Steps**
1. Open `/dashboard`.
2. Review the metric cards and ticket sections.

**Expected result**
- Dashboard shows total tickets, open tickets, done tickets, assigned to me, unassigned tickets.
- Dashboard shows tickets by assignee.
- Recent active tickets show issue key, title, status, project, assignee, and priority.

### UQ01-DASH-002 — Dashboard loading/error state

**Steps**
1. Temporarily stop API or simulate failed request.
2. Open `/dashboard`.

**Expected result**
- User sees a readable error banner.
- Page does not appear blank.

---

## Project Settings — Members

### UQ01-MEM-001 — Empty email is blocked

**Steps**
1. Open Project Settings → Members.
2. Leave email blank.
3. Click `Invite / add member`.

**Expected result**
- No API request is sent.
- User sees: `Email address is required.`

### UQ01-MEM-002 — Invalid email is blocked

**Steps**
1. Enter `abc` as email.
2. Click `Invite / add member`.

**Expected result**
- No API request is sent.
- User sees: `Enter a valid email address.`

### UQ01-MEM-003 — Valid member invite/add works

**Steps**
1. Enter `dev1@acme.com`.
2. Select a role.
3. Click `Invite / add member`.

**Expected result**
- Button shows loading state.
- Success message appears.
- Member list refreshes.

### UQ01-MEM-004 — Remove member confirmation

**Steps**
1. Click `Remove` for a member.

**Expected result**
- Confirmation dialog appears.
- Cancel does nothing.
- Confirm removes member or shows clear error.

---

## Project Settings — Custom Fields

### UQ01-FIELD-001 — Empty custom field is blocked

**Steps**
1. Open Custom Fields tab.
2. Leave name/key empty.
3. Click `Create custom field`.

**Expected result**
- No API request is sent.
- User sees field-level validation errors.

### UQ01-FIELD-002 — Field key validation

**Steps**
1. Enter name `Approval Level`.
2. Manually set key to `Approval Level`.
3. Click `Create custom field`.

**Expected result**
- No API request is sent.
- User sees valid key format requirement.

### UQ01-FIELD-003 — Dropdown options required

**Steps**
1. Select `DROPDOWN` or `MULTISELECT`.
2. Leave options blank.
3. Click `Create custom field`.

**Expected result**
- No API request is sent.
- User sees options required message.

### UQ01-FIELD-004 — Valid custom field creation

**Steps**
1. Name: `Approval Level`.
2. Key: `approval_level`.
3. Type: `TEXT`.
4. Click `Create custom field`.

**Expected result**
- Success message appears.
- Field list refreshes and shows new field.

---

## Project Settings — Issue Types

### UQ01-TYPE-001 — Empty issue type blocked

**Steps**
1. Open Issue Types tab.
2. Leave name empty.
3. Click `Create issue type`.

**Expected result**
- No API request is sent.
- User sees `Issue type name is required.`

### UQ01-TYPE-002 — Valid issue type works

**Steps**
1. Enter name `Change Request`.
2. Click `Create issue type`.

**Expected result**
- Success message appears.
- Issue type list refreshes.

---

## Project Settings — Workflows

### UQ01-WF-001 — Empty workflow blocked

**Steps**
1. Open Workflows tab.
2. Leave workflow name empty.
3. Click `Create workflow`.

**Expected result**
- No API request is sent.
- User sees `Workflow name is required.`

### UQ01-WF-002 — Valid workflow works

**Steps**
1. Enter `QA Workflow`.
2. Click `Create workflow`.

**Expected result**
- Success message appears.
- Workflow appears and becomes available in dropdowns.

### UQ01-WF-003 — Status without workflow is blocked

**Steps**
1. Leave workflow unselected.
2. Enter status name.
3. Click `Add status`.

**Expected result**
- No `/workflows//statuses` request is sent.
- User sees `Select a workflow first.`

### UQ01-WF-004 — Status without name is blocked

**Steps**
1. Select workflow.
2. Leave status name empty.
3. Click `Add status`.

**Expected result**
- No API request is sent.
- User sees `Status name is required.`

### UQ01-WF-005 — Invalid WIP limit is blocked

**Steps**
1. Select workflow.
2. Enter status name.
3. Enter WIP limit `abc`.
4. Click `Add status`.

**Expected result**
- No API request is sent.
- User sees WIP validation message.

---

## Project Settings — Transitions

### UQ01-TR-001 — Missing From/To blocked

**Steps**
1. Select workflow.
2. Leave From/To empty.
3. Click `Add transition`.

**Expected result**
- No API request is sent.
- User sees From/To validation errors.

### UQ01-TR-002 — Same From/To blocked

**Steps**
1. Select same status for From and To.
2. Enter transition name.
3. Click `Add transition`.

**Expected result**
- No API request is sent.
- User sees `From and To statuses cannot be the same.`

---

## Project Settings — Guards

### UQ01-GUARD-001 — Guard without transition blocked

**Steps**
1. Leave transition unselected.
2. Click `Add guard`.

**Expected result**
- No API request is sent.
- User sees `Select a transition first.`

### UQ01-GUARD-002 — Required field guard requires custom field

**Steps**
1. Select transition.
2. Select `REQUIRED_FIELD`.
3. Leave custom field empty.
4. Click `Add guard`.

**Expected result**
- No API request is sent.
- User sees `Select the required custom field.`

---

## Regression Tests

Run existing smoke tests after applying this UI pack:

```bash
./scripts/smoke-phase1.sh
./scripts/smoke-uc04-07-org-projects.sh
./scripts/smoke-uc17-22-config-workflow-bulk.sh
./scripts/smoke-uc23-24-notifications-filters.sh
```

Expected: all pass.
