# pm-platform-api

Express 5 REST API for the PM Platform.

## Run

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

The API expects `@pm-platform/db` to be available. In the generated monorepo this is handled by pnpm workspaces. As a separate repo, link or publish the DB package first.
