"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelTable } from "@internal/platform/models/ui";
import { Button, Meta, Tag } from "@internal/platform/ui";
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
          <div className="space-y-5">
            {/* KPI Strip */}
            {stats ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="text-xs font-medium text-slate-500">
                    Open / In Review
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {stats.open}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                  <div className="text-xs font-medium text-amber-800">
                    Pending 2nd Sign-Off
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
                    {stats.pendingSecondApproval}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-xs">
                  <div className="text-xs font-medium text-red-700">
                    High-Risk Active (&gt;=70)
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-red-700">
                    {stats.highRiskActive}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-white p-4 shadow-xs">
                  <div className="text-xs font-medium text-slate-500">
                    SLA Breached
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-red-600">
                    {stats.slaBreached}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search case #, customer, email, country..."
                className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_review">In Review</option>
                <option value="pending_second_approval">
                  Pending 2nd Approval
                </option>
                <option value="escalated">Escalated</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                aria-label="Filter by risk tier"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="all">All Risk Tiers</option>
                <option value="high">High (&gt;=70)</option>
                <option value="medium">Medium (40–69)</option>
                <option value="low">Low (&lt;40)</option>
              </select>
              <select
                aria-label="Filter by assignee"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="all">All Assignees</option>
                <option value="me">Assigned to Me</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <select
                aria-label="Filter by SLA"
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="all">All SLAs</option>
                <option value="breached">Breached</option>
                <option value="urgent">Urgent (&lt;4h)</option>
              </select>
            </div>

            {/* Platform ModelTable */}
            {loading && cases.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading KYC queue...
              </div>
            ) : (
              <ModelTable
                model={kycCaseModel}
                columns={columns}
                items={cases}
                onRowClick={(record) => setSelectedCaseId(String(record.id))}
                renderCell={(field, value, record) => {
                  if (field.key === "caseNumber") {
                    const hits = (record as QueueCase)._count.sanctionsMatches;
                    return (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {String(value)}
                        </span>
                        {hits > 0 ? (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                            {hits} hit{hits > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    );
                  }
                  if (field.key === "slaDueAt") {
                    return (
                      <SlaBadge
                        slaDueAt={String(value)}
                        status={String(record.status)}
                      />
                    );
                  }
                  return undefined;
                }}
                renderRowAction={(record) => (
                  <button
                    type="button"
                    onClick={() => setSelectedCaseId(String(record.id))}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Inspect →
                  </button>
                )}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
