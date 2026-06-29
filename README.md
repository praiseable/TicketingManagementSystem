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
