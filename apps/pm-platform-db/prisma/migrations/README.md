# Migration workflow

Use Prisma Migrate against the direct PostgreSQL connection, not PgBouncer.

```bash
cp .env.example .env
pnpm docker:up
pnpm migrate -- --name init
pnpm seed
```

Production deploy:

```bash
pnpm migrate:deploy
pnpm seed
```

Partition strategy:

- Prisma writes to parent tables.
- `scripts/partition.sh` creates monthly child partitions for `Worklog` and `PerformanceSnapshot`-adjacent reporting tables before each month begins.
- Schedule it monthly through cron or your deployment runner.
