# UI Usability Hotfix

This hotfix improves two user-facing gaps after the full use-case implementation:

1. Dashboard now shows live issue ownership: total tickets, open work, assigned tickets, unassigned tickets, priority work, and tickets by assignee.
2. Project Settings actions now show visible success/error messages, required-field validation, and loading states so buttons no longer appear to do nothing.

Apply:

```bash
./pm-platform-hotfix-ui-usability-dashboard-actions.sh /home/tms/pm-platform
sudo systemctl restart pm-platform-web
```

Verify:

```bash
curl -I http://127.0.0.1:5173/dashboard -H 'Host: tms.pbos.gov.pk'
```

Then hard refresh the browser.
