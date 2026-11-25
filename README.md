# Internal Tools Platform — KYC Review Queue Prototype

A working proof-of-concept demonstrating how a Series C fintech engineering team can use **Devin Cloud** to build a reusable horizontal internal-tools platform (`platform/`) and its first vertical application (`apps/kyc/`) with full Git, test, CI, and PR-review rigor.

## Repository Layout

- **`platform/` (`@internal/platform`)** — Reusable horizontal primitives shared by all internal tools:
  - **Identity (`platform/src/auth/`)**: Salted `scrypt` password hashing, DB-backed sessions (`sha256` token hash), HMAC-SHA256 signed HTTP-only cookies, and sliding-window login rate limiting.
  - **Permissions (`platform/src/permissions/`)**: Four roles (`analyst`, `senior_reviewer`, `compliance_admin`, `auditor`) enforced through a single `can(user, action, resource)` / `assertCan()` policy.
  - **Audit (`platform/src/audit/`)**: Append-only `AuditLog` written automatically via a Prisma `$extends` query wrapper + `AsyncLocalStorage` context, redacting sensitive fields (`passwordHash`, `tokenHash`) and blocking updates/deletes (`403`).
  - **Approvals (`platform/src/approvals/`)**: Generic state machine (`pending` -> `pending_second_approval` | `approved` | `rejected` | `escalated`) enforcing two-person sign-off when `riskScore >= 70`, separation of duties (no self-approval), and atomic entity transitions.
  - **Model-Driven Views (`platform/src/models/`)**: `defineModel()` registry, permission-checked/auto-audited CRUD loaders with field-level role visibility, and reusable `ModelTable` / `ModelDetail` React components.
- **`apps/kyc/` (`@internal/kyc`)** — Next.js 15 App Router KYC Review Queue built on `@internal/platform`:
  - Queue with risk score, live SLA countdown/breach badges, assignment, and filters (status, risk tier, assignee, SLA, search).
  - Case detail view with OCR Document Viewer, mock OFAC/EU/UN/PEP Sanctions Screening cards, approve/reject/escalate actions, two-person sign-off enforcement, and per-case + org-wide append-only audit trails.
  - Role-based views and one-click demo persona switcher alongside real email/password login.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seeded Demo Accounts (password: `demo1234`)

| Persona | Email | Role | Capabilities |
| --- | --- | --- | --- |
| Alex Rivera | `analyst@fintech.demo` | `analyst` | Claim cases, approve low-risk (`< 70`), submit 1st sign-off or escalate high-risk |
| Samira Patel | `senior@fintech.demo` | `senior_reviewer` | All analyst actions + 2nd-approver sign-off on high-risk (`>= 70`) cases |
| Casey Morgan | `admin@fintech.demo` | `compliance_admin` | Reassign any case, approve high-risk cases, full audit access |
| Avery Chen | `auditor@fintech.demo` | `auditor` | Read-only across all cases and audit logs; mutations return `403` |

## Verification & Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Production Database Migration (SQLite -> Managed Postgres)

This demo uses SQLite (`DATABASE_URL="file:./dev.db"`) for zero-config local execution. To deploy against managed PostgreSQL (AWS RDS, Supabase, Neon):

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `platform/prisma/schema.prisma`.
2. Set `DATABASE_URL` to your PostgreSQL connection string and set a strong `SESSION_SECRET`.
3. Run `pnpm db:generate && pnpm db:push` (or `prisma migrate deploy`).
