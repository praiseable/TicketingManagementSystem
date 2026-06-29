# Feature Pack 05 — UC-04 to UC-07 Organization, Projects, Members, Roles

## Scope

- UC-04 Create / manage organisation baseline
- UC-05 Create project with default configuration
- UC-06 Invite team members
- UC-07 Assign project roles

## Delivered

- Project creation now bootstraps issue types: Bug, Story, Task.
- Project creation now bootstraps default workflow statuses: Backlog, Todo, In Progress, In Review, Done.
- Project creation creates default linear workflow transitions.
- Project creator becomes OWNER.
- Existing organization users can be invited/added to a project immediately.
- External emails create invitation records with devToken for later onboarding.
- Member roles can be updated with last-owner protection.
- Members can be removed with last-owner protection.
- Project list has a real create-project form.
- Project settings has general form, invite form, member role management, issue type display, workflow display.
- Smoke test added: scripts/smoke-uc04-07-org-projects.sh

## Verification

```bash
./scripts/smoke-uc04-07-org-projects.sh
```
