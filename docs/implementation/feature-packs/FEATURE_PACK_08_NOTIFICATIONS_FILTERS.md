# Feature Pack 08 — UC-23 to UC-24 Notifications and Issue Filters

Implements the final Phase 1 use-case block:

- UC-23 View notifications
- UC-24 Filter issue list

## Backend

- Notification listing with unread filter, pagination, unread count
- Mark notification as read
- Mark all notifications as read
- Default notification preferences
- Update notification preferences
- Saved filter upsert/list/delete
- Robust search/filter query parsing
- Issue list date range filtering

## Frontend

- Notifications page with unread filter, mark read, mark all read, preferences
- Issue list filters for search, status, type, assignee, priority, label, and created date range
- Saved filter creation/listing/apply/delete
- Bulk action area retained

## Smoke Test

```bash
./scripts/smoke-uc23-24-notifications-filters.sh
```
