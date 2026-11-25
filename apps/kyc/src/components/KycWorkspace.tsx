"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelTable } from "@internal/platform/models/ui";
import {
  Button,
  Meta,
  Tag,
  TagButton,
  selectClass,
} from "@internal/platform/ui";
import type { SessionUser } from "@internal/platform/types";
import { kycCaseModel } from "@/lib/kyc-model";
import { CaseDetailPanel } from "./CaseDetailPanel";
import { SlaBadge } from "./SlaBadge";

interface QueueCase extends Record<string, unknown> {
  id: string;
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  country: string;
  accountType: string;
  riskScore: number;
  status: string;
  slaDueAt: string;
  assigneeName: string;
  _count: { documents: number; sanctionsMatches: number };
}

interface QueueStats {
  total: number;
  open: number;
  pendingSecondApproval: number;
  highRiskActive: number;
  slaBreached: number;
}

interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["in_review", "In review"],
  ["pending_second_approval", "2nd sign-off"],
  ["escalated", "Escalated"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
] as const;

const RISK_FILTERS = [
  ["all", "Any risk"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
] as const;

const UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function KycWorkspace({
  initialUser,
  onSignedOut,
}: {
  initialUser: SessionUser;
  onSignedOut: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"queue" | "audit">("queue");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [cases, setCases] = useState<QueueCase[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");

  const columns = useMemo(
    () =>
      kycCaseModel.listColumns
        .map((key) => kycCaseModel.fields.find((f) => f.key === key))
        .filter((f): f is (typeof kycCaseModel.fields)[number] => Boolean(f)),
    [],
  );

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (riskFilter !== "all") qs.set("riskTier", riskFilter);
      if (assigneeFilter !== "all") qs.set("assignee", assigneeFilter);
      if (slaFilter !== "all") qs.set("sla", slaFilter);

      const res = await fetch(`/api/cases?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        cases: QueueCase[];
        stats: QueueStats;
      };
      setCases(data.cases);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, riskFilter, assigneeFilter, slaFilter]);

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/audit", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { entries: AuditEntry[] };
    setAuditEntries(data.entries);
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (activeTab === "audit") {
      void loadAudit();
    }
  }, [activeTab, loadAudit]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    onSignedOut();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-6 px-8">
          <div className="flex h-full items-center gap-10">
            <span className="text-[15px]">KYC review</span>
            <nav className="flex h-full items-center gap-6 text-[13px]">
              {(
                [
                  ["queue", "Queue"],
                  ["audit", "Audit log"],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  aria-current={activeTab === tab ? "page" : undefined}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedCaseId(null);
                  }}
                  className={`h-full transition-colors ${
                    activeTab === tab
                      ? "text-accent shadow-[inset_0_-1px_0_var(--color-accent)]"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px]">{initialUser.name}</span>
            <Meta>{initialUser.role}</Meta>
            {initialUser.role === "auditor" ? (
              <Tag tone="muted">Read-only</Tag>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8 py-10">
        {activeTab === "audit" ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Append-Only Organization Audit Log ({auditEntries.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Written automatically via Prisma <code className="font-mono">$extends</code> on every mutation. Updates and deletes throw <code className="font-mono">403</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadAudit()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-600">
                        {UTC_FORMATTER.format(new Date(entry.createdAt))}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700">
                        {entry.actorEmail}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">
                        {entry.entityType}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {entry.reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : selectedCaseId ? (
          <CaseDetailPanel
            caseId={selectedCaseId}
            currentUser={initialUser}
            onBack={() => setSelectedCaseId(null)}
            onMutated={() => void loadCases()}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h1 className="text-2xl tracking-[-0.02em]">Review queue</h1>
              <Meta>
                {cases.length} {cases.length === 1 ? "case" : "cases"}
              </Meta>
            </div>

            {stats ? (
              <dl className="flex flex-wrap gap-x-10 gap-y-2 border-y border-hairline py-3 text-[13px]">
                {(
                  [
                    ["Open", stats.open, false],
                    ["Awaiting second sign-off", stats.pendingSecondApproval, false],
                    ["High risk", stats.highRiskActive, false],
                    ["SLA breached", stats.slaBreached, stats.slaBreached > 0],
                  ] as const
                ).map(([label, value, alert]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd
                      className={`font-mono tabular-nums ${alert ? "text-danger" : "text-ink"}`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div
                role="group"
                aria-label="Filter by status"
                className="flex flex-wrap items-center gap-0.5"
              >
                {STATUS_FILTERS.map(([value, label]) => (
                  <TagButton
                    key={value}
                    selected={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </TagButton>
                ))}
              </div>
              <span aria-hidden className="h-4 w-px bg-hairline-strong" />
              <div
                role="group"
                aria-label="Filter by risk tier"
                className="flex flex-wrap items-center gap-0.5"
              >
                {RISK_FILTERS.map(([value, label]) => (
                  <TagButton
                    key={value}
                    selected={riskFilter === value}
                    onClick={() => setRiskFilter(value)}
                  >
                    {label}
                  </TagButton>
                ))}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  aria-label="Search cases"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className={`${selectClass} w-56 placeholder:text-ink-faint`}
                />
                <select
                  aria-label="Filter by assignee"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">Any assignee</option>
                  <option value="me">Assigned to me</option>
                  <option value="unassigned">Unassigned</option>
                </select>
                <select
                  aria-label="Filter by SLA"
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">Any SLA</option>
                  <option value="breached">Breached</option>
                  <option value="urgent">Due in 4h</option>
                </select>
              </div>
            </div>

            {loading && cases.length === 0 ? (
              <p className="border-y border-hairline py-12 text-center text-[13px] text-ink-muted">
                Loading queue…
              </p>
            ) : (
              <ModelTable
                model={kycCaseModel}
                columns={columns}
                items={cases}
                showIndex
                emptyMessage="No cases match these filters."
                onRowClick={(record) => setSelectedCaseId(String(record.id))}
                renderCell={(field, value, record) => {
                  const row = record as QueueCase;
                  if (field.key === "caseNumber") {
                    const hits = row._count.sanctionsMatches;
                    return (
                      <span className="inline-flex items-baseline gap-2">
                        <span className="font-mono text-xs">{String(value)}</span>
                        {hits > 0 ? (
                          <Tag tone="danger">
                            {hits} {hits > 1 ? "hits" : "hit"}
                          </Tag>
                        ) : null}
                      </span>
                    );
                  }
                  if (field.key === "customerName") {
                    return (
                      <span className="inline-flex items-baseline gap-2">
                        <span>{String(value)}</span>
                        <Meta>{row.customerEmail}</Meta>
                      </span>
                    );
                  }
                  if (field.key === "country") {
                    return <span className="font-mono text-xs">{String(value)}</span>;
                  }
                  if (field.key === "assigneeName" && value === "Unassigned") {
                    return <span className="text-ink-faint">Unassigned</span>;
                  }
                  if (field.key === "slaDueAt") {
                    return (
                      <SlaBadge slaDueAt={String(value)} status={row.status} />
                    );
                  }
                  return undefined;
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
