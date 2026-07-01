# Feature Pack 14 — UC-45 to UC-48 Email, Preferences, Webhooks, GitHub Linking

## Scope

- UC-45 Receive email notification
- UC-46 Configure notification preferences
- UC-47 Configure webhook
- UC-48 Link GitHub commit

## Verification

Run:

```bash
./scripts/smoke-uc45-48-integrations.sh
```

Expected final line:

```text
UC-45 to UC-48 integration smoke test passed
```

## Notes

In development, SMTP may not be configured. The email worker writes a dev-safe audit entry with `action=email.notification.sent` so the queue path can still be verified without sending public email.
