# Feature Pack 02 — Issue Detail End-to-End

This pack deepens Phase 1 issue functionality on the single-server deployment for `https://tms.pbos.gov.pk`.

## Implemented

- Full issue detail page with editable title, description, status, assignee, priority, type, estimates, story points, due date, and labels.
- Comment create, edit, delete, threaded reply rendering, and email-style `@user@email.com` mention parsing.
- Attachment upload, download via MinIO presigned URL, delete, drag/drop file dropzone, and BigInt-safe API serialization.
- Sub-task creation from the issue detail page.
- Issue link creation/removal using target issue key such as `PM-12`.
- Watch/unwatch support and watcher display.
- Issue history events for create, update, labels, comments, attachments, and links.
- Worklog visibility and manual log-work dialog.
- Live timer stop now saves a worklog directly without creating duplicate manual worklogs.

## Apply

```bash
cd /home/tms
chmod +x pm-platform-feature-pack-02-issue-detail.sh
./pm-platform-feature-pack-02-issue-detail.sh /home/tms/pm-platform
sudo systemctl restart pm-platform-api pm-platform-web
```

## Smoke test

```bash
curl -i http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1:5173/dashboard -H 'Host: tms.pbos.gov.pk'
```

Then open an issue detail page:

```text
https://tms.pbos.gov.pk/projects/<PROJECT_ID>/issues/<ISSUE_ID>
```
