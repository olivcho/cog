# Internal Tools Platform (Prototype)

Horizontal internal tools platform built with Next.js, TypeScript, Prisma, and SQLite (designed to swap cleanly to managed PostgreSQL on AWS RDS or Supabase).

## Repository Layout

- `platform/` (`@internal/platform`) — Shared primitives: Prisma schema & DB client, identity/sessions, RBAC (`can(user, action, resource)`), append-only automatic audit trail, generic two-person approvals state machine, and model-driven CRUD views.
- `apps/kyc/` (`@internal/kyc`) — KYC Review Queue application built on `@internal/platform`.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Health check: `GET /api/health`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Switching to Managed PostgreSQL

In `platform/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`, point `DATABASE_URL` to your AWS RDS / Supabase / Neon instance, and run `pnpm db:push` (or `prisma migrate deploy`).
