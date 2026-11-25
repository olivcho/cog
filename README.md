# Internal Tools Platform: KYC Review Queue

A shared platform for building internal tools, and a KYC review queue built on it. The platform provides login, roles, an audit log, approvals, data models and UI.

## Two layers

### Platform (`platform/`, `@internal/platform`)

Reusable building blocks that every internal app gets.

| Area | What you get | Where |
| --- | --- | --- |
| Identity | Email/password login, database-backed sessions, signed HTTP-only cookies, login rate limiting | `platform/src/auth/` |
| Permissions | Four roles and one `can(user, action, resource)` check used by APIs and UI | `platform/src/permissions/` |
| Audit log | Every database write is logged automatically with actor, before/after and reason. Entries can't be edited or deleted | `platform/src/audit/` |
| Approvals | Reusable approval state machine: two-person sign-off above a risk threshold, no self-approval | `platform/src/approvals/` |
| Data models | `defineModel()` registry with field-level role visibility, plus permission-checked, audited CRUD loaders | `platform/src/models/` |
| UI kit | Login, app shell, tables, filters, stats, SLA timer and audit log panel | `platform/src/ui/`, `platform/src/models/ui/` |
| HTTP | Ready-made route handlers (login, logout, me, audit, health) and CSRF checks | `platform/src/http/` |

### KYC review queue (`apps/kyc/`, `@internal/kyc`)

A Next.js 15 app built on the platform.

- Queue of KYC cases with risk score, SLA countdown, sanctions hits, filters, search and sorting.
- Case detail with the customer profile, documents with OCR fields, and sanctions/PEP screening results.
- Approve, reject or escalate with a required reason. Cases with risk score 70 or higher need sign-off from two different reviewers.
- Per-case audit trail and an org-wide audit log.
- Role-based views, including a read-only auditor.

Document OCR and sanctions screening use seeded demo data, not live providers.

## Run it

Requires Node 22.12+ (Node 24 recommended) and pnpm 10.

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

All accounts use the password `demo1234`. The login page also has one-click sign-in for each.

| Persona | Email | Role | Can do |
| --- | --- | --- | --- |
| Alex Rivera | `analyst@fintech.demo` | Analyst | Claim cases, approve low-risk cases, give first sign-off or escalate high-risk cases |
| Samira Patel | `senior@fintech.demo` | Senior reviewer | Everything an analyst can, plus second sign-off on high-risk cases |
| Casey Morgan | `admin@fintech.demo` | Compliance admin | Reassign any case, approve high-risk cases, full audit access |
| Avery Chen | `auditor@fintech.demo` | Auditor | Read-only access to every case and the audit log |

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

GitHub Actions runs the same steps on every PR. If you run `pnpm build` while `pnpm dev` is running, restart `pnpm dev` afterwards.

## Moving to Postgres

The demo uses SQLite so it runs without setup. To use managed Postgres (AWS RDS, Supabase, Neon):

1. Set `provider = "postgresql"` in `platform/prisma/schema.prisma`.
2. Set `DATABASE_URL` to your connection string and set a strong `SESSION_SECRET`.
3. Run `pnpm db:generate && pnpm db:push` (or `prisma migrate deploy`).
