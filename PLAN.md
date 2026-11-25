# Architecture & Feature Plan

## Goal

Build a working horizontal internal tools platform (`platform/`) and its first vertical fintech app (`apps/kyc/`) in ~2 hours using Devin Cloud, demonstrating how an engineering team can replace core Microsoft Power Apps capabilities while keeping Git, tests, CI, and PR review as first-class engineering practices.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4
- **Data Layer**: Prisma 6 + SQLite (`dev.db`) for zero-config local demo; portable `String` columns and `DATABASE_URL` env loading allow swapping `provider = "postgresql"` for AWS RDS / Supabase / Neon later
- **Workspace & Tooling**: `pnpm` workspaces (`platform/`, `apps/*`), Vitest, ESLint 9, GitHub Actions CI (`db:generate`, `typecheck`, `lint`, `test`, `build`)

## Repository Layout

```text
platform/                      # @internal/platform — horizontal primitives
  prisma/schema.prisma         # User, Session, AuditLog, ApprovalRequest, ApprovalStep, KycCase, KycDocument, SanctionsMatch
  src/
    db/                        # Lazy Prisma client, workspace .env loader, idempotent demo seeder (4 personas + 12 cases)
    auth/                      # scrypt passwords, HMAC-signed DB sessions, atomic login rate limiter
    permissions/               # Roles + single can(user, action, resource) policy
    audit/                     # AsyncLocalStorage context + append-only Prisma $extends auto-audit
    approvals/                 # Generic two-person approval state machine
    models/                    # defineModel() registry, permission-checked/audited CRUD loaders, ModelTable/ModelDetail UI
apps/
  kyc/                         # @internal/kyc — KYC Review Queue built on @internal/platform
    src/app/api/               # Auth, health, KYC cases, assign, decision, and org audit log endpoints
    src/components/            # Login + role switcher, KYC queue (ModelTable), case detail, OCR doc viewer, sanctions/PEP cards, SLA badge
    src/lib/                   # Session cookie auth, CSRF guard, kycCaseModel definition, audited Prisma singleton
```

## Horizontal Platform Primitives (`platform/`)

1. **Identity (`platform/src/auth/`)** — *Shipped in PR #2*
   - Salted `scrypt` password hashing with constant-time verification.
   - DB-backed `Session` tokens (`sha256` hash in DB) paired with HMAC-SHA256 signed `HttpOnly` cookies (`SameSite=Lax`, `Secure` in prod) and expiry cleanup.
   - Atomic sliding-window `LoginRateLimiter` + same-origin / JSON CSRF guards on mutating endpoints.
2. **Permissions (`platform/src/permissions/`)** — *Shipped in PR #2*
   - Four roles: `analyst`, `senior_reviewer`, `compliance_admin`, `auditor`.
   - Single `can(user, action, resource)` + `assertCan()` (`403`) check enforced in APIs/services and mirrored in UI capabilities.
   - Cross-cutting invariants enforced for every role: append-only `audit_log`, no self-approval on step 2, `senior_reviewer+` required for high-risk (`riskScore >= 70`) second sign-off, and `compliance_admin`-only case reassignment.
3. **Audit Trail (`platform/src/audit/`)** — *Shipped in PR #3*
   - Append-only `AuditLog` written automatically on every data mutation (`create`, `update`, `upsert`, `delete`, bulk ops) via a Prisma `$extends` wrapper reading actor & reason from `AsyncLocalStorage`.
   - Captures `actorId`, `actorEmail`, `action`, `entityType`, `entityId`, scalar `beforeJson` / `afterJson` (stripping included relations and redacting `passwordHash` / `tokenHash`), `reason`, and `createdAt`.
   - Blocks any `update`, `updateMany`, `upsert`, `delete`, or `deleteMany` on `AuditLog` with `AuditImmutabilityError` (`403`) and supports atomic `runAuditedTransaction`.
4. **Approvals (`platform/src/approvals/`)** — *Shipped in PR #3*
   - Generic state machine (`pending` -> `pending_second_approval` | `approved` | `rejected` | `escalated`) reusable across KYC, refunds, or any future internal tool.
   - Configurable risk threshold (`riskScore >= 70` requires 2 approvers), transactional step recording, self-approval prevention (`step2.actorId !== step1.actorId`), `onTransition` atomic entity sync, and RBAC enforcement via `assertCan()`.
5. **Model-Driven Data Views (`platform/src/models/`)** — *Shipped in PR #5*
   - Declarative `defineModel()` registry with field-level `allowedRoles`, `filterable`, `sortable`, `searchableFields`, and `editableFields` allow-lists.
   - Permission-checked and auto-audited CRUD loaders (`listModelRecords`, `getModelRecord`, `updateModelRecord`, `deleteModelRecord`) plus reusable `ModelTable`, `ModelDetail`, and `FieldValue` React components exported via `@internal/platform/models/ui`.

## First Vertical App: KYC Review Queue (`apps/kyc/`) — *Shipped in PR 5*

- **Review Queue**: Built on `@internal/platform/models/ui` `ModelTable`; filterable by status, risk tier, assignee (`me` / `unassigned`), SLA state (`breached` / `urgent`), and search; displays risk score (`0–100`), live SLA countdown / breach badges (`SlaBadge`), hit count, and KPI strip.
- **Case Detail**: Customer profile, interactive OCR Document Viewer (`passport`, `drivers_license`, `proof_of_address`, `bank_statement`, `corporate_filing`), mock Sanctions & PEP Screening cards (`OFAC_SDN`, `EU_SANCTIONS`, `UN_SANCTIONS`, `PEP_GLOBAL` with match scores and disposition), and per-case append-only audit trail.
- **Decision Workflow**: Claim/reassign (`POST /api/cases/[id]/assign`) and approve/reject/escalate (`POST /api/cases/[id]/decision`) with mandatory reason; cases with `riskScore >= 70` automatically require two-person sign-off (`pending_second_approval` -> second approval by a different `senior_reviewer` or `compliance_admin`).
- **Role-Based Views & Demo Switcher**:
  - Real email/password login + one-click demo persona switcher for `analyst`, `senior_reviewer`, `compliance_admin`, and read-only `auditor`.
  - Org-wide append-only audit log viewer (`GET /api/audit`).
- **Seed Data**: Idempotent `pnpm db:seed` creates 4 personas (`demo1234`) and 12 realistic customers spanning low/medium/high risk, breached/urgent SLAs, OFAC/EU/UN/PEP hits, pending second approval (`KYC-2026-1001`), escalated, approved, and rejected cases.

## Delivery Sequence (Engineering Process as Demo Material)

| PR | Scope | Status |
| --- | --- | --- |
| **PR 1** | Workspace scaffold, Prisma 6 SQLite schema, `apps/kyc` shell, Vitest, GitHub Actions CI | Merged (#1) |
| **PR 2** | `platform` Identity/sessions, `can(user, action, resource)` RBAC, `/api/auth/*`, CSRF & rate limiting | Merged (#2) |
| **PR 3** | `platform` Auto-audit Prisma extension + generic two-person approvals state machine | Merged (#3) |
| **PR 4** | `platform` `defineModel()` registry, permission-checked/audited CRUD loaders, `ModelTable`/`ModelDetail` UI | Merged (#5) |
| **PR 5** | `apps/kyc` full KYC review queue UI, document/sanctions viewer, role views, seed data, tests, README | Merged (#6) |
