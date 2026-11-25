"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelTable } from "@internal/platform/models/ui";
import {
  AppShell,
  AuditLogPanel,
  FilterBar,
  FilterSelect,
  SearchInput,
  SlaBadge,
  StatCard,
  StatGrid,
  useSession,
} from "@internal/platform/ui";
import { kycCaseModel } from "@/lib/kyc-model";
import { CaseDetailPanel } from "./CaseDetailPanel";

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

type Tab = "queue" | "audit";

const TABS = [
  { id: "queue", label: "Queue" },
  { id: "audit", label: "Audit log" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "pending_second_approval", label: "Pending 2nd Approval" },
  { value: "escalated", label: "Escalated" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const RISK_OPTIONS = [
  { value: "all", label: "All Risk Tiers" },
  { value: "high", label: "High (>=70)" },
  { value: "medium", label: "Medium (40–69)" },
  { value: "low", label: "Low (<40)" },
];

const ASSIGNEE_OPTIONS = [
  { value: "all", label: "All Assignees" },
  { value: "me", label: "Assigned to Me" },
  { value: "unassigned", label: "Unassigned" },
];

const SLA_OPTIONS = [
  { value: "all", label: "All SLAs" },
  { value: "breached", label: "Breached" },
  { value: "urgent", label: "Urgent (<4h)" },
];

const CLOSED_STATUSES = new Set(["approved", "rejected"]);

export function KycWorkspace() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [cases, setCases] = useState<QueueCase[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  return (
    <AppShell
      appName="KYC review"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedCaseId(null);
      }}
    >
      {activeTab === "audit" ? (
        <AuditLogPanel />
      ) : selectedCaseId ? (
        <CaseDetailPanel
          caseId={selectedCaseId}
          currentUser={user}
          onBack={() => setSelectedCaseId(null)}
          onMutated={() => void loadCases()}
        />
      ) : (
        <div className="space-y-5">
          {stats ? (
            <StatGrid>
              <StatCard label="Open / In Review" value={stats.open} />
              <StatCard
                label="Pending 2nd Sign-Off"
                value={stats.pendingSecondApproval}
                tone="warning"
              />
              <StatCard
                label="High-Risk Active (>=70)"
                value={stats.highRiskActive}
                tone="danger"
              />
              <StatCard
                label="SLA Breached"
                value={stats.slaBreached}
                tone="danger-subtle"
              />
            </StatGrid>
          ) : null}

          <FilterBar>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search case #, customer, email, country..."
            />
            <FilterSelect
              label="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              label="Filter by risk tier"
              value={riskFilter}
              onChange={setRiskFilter}
              options={RISK_OPTIONS}
            />
            <FilterSelect
              label="Filter by assignee"
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={ASSIGNEE_OPTIONS}
            />
            <FilterSelect
              label="Filter by SLA"
              value={slaFilter}
              onChange={setSlaFilter}
              options={SLA_OPTIONS}
            />
          </FilterBar>

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
                      dueAt={String(value)}
                      closed={CLOSED_STATUSES.has(String(record.status))}
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
    </AppShell>
  );
}
