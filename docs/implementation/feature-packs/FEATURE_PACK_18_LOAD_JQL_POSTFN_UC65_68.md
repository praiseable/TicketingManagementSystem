# Feature Pack 18 — UC-65 to UC-68

## Scope

- UC-65 Load test 500 users baseline
- UC-66 Query with JQL
- UC-67 JQL autocomplete
- UC-68 Workflow post-function

Smoke test:

```bash
./scripts/smoke-uc65-68-load-jql-postfn.sh
```

For controlled UAT load baseline:

```bash
USERS=500 ITERATIONS=1 node scripts/loadtest-uc65-baseline.js
```
