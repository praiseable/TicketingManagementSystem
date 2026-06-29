# pm-platform-db

PostgreSQL 15 + Prisma database project for the PM Platform.

## Run

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm docker:up
pnpm setup
```

## Seed users

- `admin@acme.com` / `Test@1234`
- `dev1@acme.com` / `Test@1234`
- `dev2@acme.com` / `Test@1234`

## Services

- PostgreSQL: `localhost:5432`
- PgBouncer: `localhost:6432`
- Redis: `localhost:6379`
- Meilisearch: `localhost:7700`
- MinIO: `localhost:9000`
