import { HIGH_RISK_THRESHOLD, ROLES } from "@internal/platform";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="border-b border-neutral-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Internal Tools Platform
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
          KYC Review Queue
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Workspace scaffold active. Platform primitives and KYC queue workflows are landing incrementally via reviewed PRs.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-900">Configured Roles</h2>
          <ul className="mt-3 space-y-1.5 font-mono text-xs text-neutral-700">
            {ROLES.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-900">Approval Policy</h2>
          <p className="mt-3 text-sm text-neutral-700">
            Two-person sign-off required when{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              riskScore &gt;= {HIGH_RISK_THRESHOLD}
            </code>
            .
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Health check available at <code>/api/health</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
