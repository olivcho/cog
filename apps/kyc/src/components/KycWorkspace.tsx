"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelTable } from "@internal/platform/models/ui";
import {
  AppShell,
  AuditLogPanel,
  FilterBar,
  FilterSelect,
  Meta,
  SearchInput,
  SlaBadge,
  StatCard,
  StatGrid,
  Tag,
  TagButton,
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

const ASSIGNEE_OPTIONS = [
  { value: "all", label: "Any assignee" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const SLA_OPTIONS = [
  { value: "all", label: "Any SLA" },
  { value: "breached", label: "Breached" },
  { value: "urgent", label: "Due in 4h" },
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="text-2xl tracking-[-0.02em]">Review queue</h1>
            <Meta>
              {cases.length} {cases.length === 1 ? "case" : "cases"}
            </Meta>
          </div>

          {stats ? (
            <StatGrid>
              <StatCard label="Open" value={stats.open} />
              <StatCard
                label="Awaiting second sign-off"
                value={stats.pendingSecondApproval}
              />
              <StatCard label="High risk" value={stats.highRiskActive} />
              <StatCard
                label="SLA breached"
                value={stats.slaBreached}
                tone={stats.slaBreached > 0 ? "danger" : "default"}
              />
            </StatGrid>
          ) : null}

          <FilterBar>
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
              <SearchInput
                label="Search cases"
                value={search}
                onChange={setSearch}
                placeholder="Search"
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
            </div>
          </FilterBar>

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
                    <SlaBadge
                      dueAt={String(value)}
                      closed={CLOSED_STATUSES.has(row.status)}
                    />
                  );
                }
                return undefined;
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
