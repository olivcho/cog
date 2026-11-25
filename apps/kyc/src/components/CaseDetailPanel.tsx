"use client";

import { useCallback, useEffect, useState } from "react";
import { HIGH_RISK_THRESHOLD, type SessionUser } from "@internal/platform/types";
import { AuditTrail, RiskScore } from "@internal/platform/models/ui";
import {
  Button,
  Meta,
  Notice,
  Section,
  Tag,
  formatDateTime,
  humanize,
  inputClass,
  labelClass,
  selectClass,
} from "@internal/platform/ui";
import { SlaBadge } from "./SlaBadge";

export interface CaseDocument {
  id: string;
  docType: string;
  fileName: string;
  status: string;
  extractedJson: string;
  uploadedAt: string;
}

export interface CaseSanctionsMatch {
  id: string;
  listName: string;
  matchedName: string;
  matchScore: number;
  category: string;
  details: string;
  disposition: string;
}

export interface CaseApprovalStep {
  id: string;
  stepNumber: number;
  actorId: string;
  decision: string;
  reason: string;
  createdAt: string;
  actor: { id: string; name: string; email: string; role: string };
}

export interface CaseApprovalRequest {
  id: string;
  status: string;
  requiredApprovals: number;
  riskScore: number;
  steps: CaseApprovalStep[];
}

export interface CaseAuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  reason: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

export interface CaseDetailPayload {
  kycCase: {
    id: string;
    caseNumber: string;
    customerName: string;
    customerEmail: string;
    country: string;
    accountType: string;
    riskScore: number;
    status: string;
    slaDueAt: string;
    assigneeId: string | null;
    assigneeName: string;
    summary: string | null;
    documents: CaseDocument[];
    sanctionsMatches: CaseSanctionsMatch[];
  };
  approvalRequest: CaseApprovalRequest | null;
  auditTrail: CaseAuditEntry[];
  reviewers: { id: string; name: string; email: string; role: string }[];
  capabilities: {
    canClaim: boolean;
    canReassign: boolean;
    canApprove: boolean;
    canReject: boolean;
    canEscalate: boolean;
    canViewAudit: boolean;
    isSelfApprovalBlocked: boolean;
  };
}

function safeParseJson(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function CaseDetailPanel({
  caseId,
  currentUser,
  onBack,
  onMutated,
}: {
  caseId: string;
  currentUser: SessionUser;
  onBack: () => void;
  onMutated: () => void;
}) {
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
      const data = (await res.json()) as CaseDetailPayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "We couldn't load this case.");
        return;
      }
      setDetail(data);
      setSelectedDocId((prev) =>
        prev && data.kycCase.documents.some((d) => d.id === prev)
          ? prev
          : (data.kycCase.documents[0]?.id ?? null),
      );
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleAssign(assigneeId: string | null) {
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "We couldn't assign this case.");
        return;
      }
      await loadDetail();
      onMutated();
    } catch {
      setActionError("We couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(
    decision: "approved" | "rejected" | "escalated",
  ) {
    setActionError(null);
    if (!reason.trim()) {
      setActionError("Add a reason before you decide.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "We couldn't record this decision.");
        return;
      }
      setReason("");
      await loadDetail();
      onMutated();
    } catch {
      setActionError("We couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !detail) {
    return <p className="py-12 text-[13px] text-ink-muted">Loading case…</p>;
  }

  if (error || !detail) {
    return (
      <Notice label="Error" tone="danger">
        {error ?? "This case is unavailable."}
      </Notice>
    );
  }

  const { kycCase, approvalRequest, auditTrail, reviewers, capabilities } = detail;
  const isHighRisk = kycCase.riskScore >= HIGH_RISK_THRESHOLD;
  const approvedSteps =
    approvalRequest?.steps.filter((s) => s.decision === "approved") ?? [];
  const requiredApprovals = isHighRisk ? 2 : 1;
  const hasPepMatch = kycCase.sanctionsMatches.some(
    (m) => m.category.toLowerCase() === "pep",
  );
  const isClosed = kycCase.status === "approved" || kycCase.status === "rejected";
  const selectedDoc =
    kycCase.documents.find((d) => d.id === selectedDocId) ??
    kycCase.documents[0] ??
    null;

  const approveLabel =
    isHighRisk && approvedSteps.length === 0
      ? "Submit first sign-off"
      : isHighRisk && approvedSteps.length === 1
        ? "Approve with second sign-off"
        : "Approve";

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2.5">
          ← Queue
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          {capabilities.canReassign ? (
            <label className="flex items-center gap-2 text-[13px] text-ink-muted">
              Assignee
              <select
                disabled={submitting}
                value={kycCase.assigneeId ?? ""}
                onChange={(e) =>
                  void handleAssign(e.target.value ? e.target.value : null)
                }
                className={selectClass}
              >
                <option value="">Unassigned</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {humanize(r.role)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {capabilities.canClaim ? (
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => void handleAssign(currentUser.id)}
            >
              Claim
            </Button>
          ) : null}
        </div>
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Meta>{kycCase.caseNumber}</Meta>
          <span className="text-ink-faint">·</span>
          <SlaBadge slaDueAt={kycCase.slaDueAt} status={kycCase.status} />
        </div>
        <h1 className="text-[32px] leading-[1.1] tracking-[-0.02em]">
          {kycCase.customerName}
        </h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Tag tone={kycCase.status === "escalated" ? "danger" : isClosed ? "muted" : "default"}>
            {humanize(kycCase.status)}
          </Tag>
          {isHighRisk ? <Tag tone="danger">High risk</Tag> : null}
          {hasPepMatch ? <Tag tone="danger">PEP</Tag> : null}
          {isHighRisk ? <Tag>2-person review</Tag> : null}
        </div>
      </header>

      <Section index={1} title="Customer">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["Risk score", <RiskScore key="r" score={kycCase.riskScore} />],
              ["Email", <span key="e" className="font-mono text-xs">{kycCase.customerEmail}</span>],
              ["Country", <span key="c" className="font-mono text-xs">{kycCase.country}</span>],
              ["Account", humanize(kycCase.accountType)],
              ["Assignee", kycCase.assigneeName],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>
                <Meta>{label}</Meta>
              </dt>
              <dd className="mt-1 text-[13px]">{value}</dd>
            </div>
          ))}
        </dl>
        {kycCase.summary ? (
          <p className="mt-6 max-w-[65ch] text-sm leading-relaxed">
            {kycCase.summary}
          </p>
        ) : null}
      </Section>

      <Section
        index={2}
        title="Documents"
        aside={<Meta>
            {kycCase.documents.length}{" "}
            {kycCase.documents.length === 1 ? "file" : "files"}
          </Meta>}
      >
        {kycCase.documents.length === 0 || !selectedDoc ? (
          <p className="text-[13px] text-ink-muted">No documents uploaded.</p>
        ) : (
          <div>
            <div role="tablist" className="flex flex-wrap gap-6 border-b border-hairline text-[13px]">
              {kycCase.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedDoc.id === doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`-mb-px pb-2 transition-colors ${
                    selectedDoc.id === doc.id
                      ? "border-b border-ink text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {humanize(doc.docType)}
                </button>
              ))}
            </div>

            <div className="mt-4 border border-hairline-strong bg-white/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-xs">{selectedDoc.fileName}</span>
                <Tag
                  tone={
                    selectedDoc.status === "flagged"
                      ? "danger"
                      : selectedDoc.status === "verified"
                        ? "muted"
                        : "default"
                  }
                >
                  {humanize(selectedDoc.status)}
                </Tag>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-2">
                {Object.entries(safeParseJson(selectedDoc.extractedJson)).map(
                  ([k, v]) => (
                    <div key={k} className="grid grid-cols-[140px_1fr] gap-3">
                      <dt>
                        <Meta>{k.replace(/([A-Z])/g, " $1").toLowerCase()}</Meta>
                      </dt>
                      <dd className="font-mono text-xs">{String(v)}</dd>
                    </div>
                  ),
                )}
              </dl>
            </div>
          </div>
        )}
      </Section>

      <Section
        index={3}
        title="Screening"
        aside={<Meta>OFAC · EU · UN · PEP</Meta>}
      >
        {kycCase.sanctionsMatches.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No matches on OFAC, EU, UN, or PEP lists.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-hairline-strong text-xs text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-normal">List</th>
                  <th className="px-3 py-2 font-normal">Matched name</th>
                  <th className="px-3 py-2 font-normal">Category</th>
                  <th className="px-3 py-2 text-right font-normal">Score</th>
                  <th className="py-2 pl-3 font-normal">Disposition</th>
                </tr>
              </thead>
              <tbody>
                {kycCase.sanctionsMatches.map((match) => (
                  <tr key={match.id} className="border-b border-hairline align-baseline">
                    <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                      {match.listName}
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{match.matchedName}</div>
                      <div className="mt-0.5 max-w-[60ch] text-ink-muted">
                        {match.details}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Tag tone="muted">{match.category}</Tag>
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        match.matchScore >= 80 ? "text-danger" : ""
                      }`}
                    >
                      {match.matchScore}%
                    </td>
                    <td className="py-2.5 pl-3 whitespace-nowrap">
                      {humanize(match.disposition)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        index={4}
        title="Decision"
        aside={
          <Meta>
            {approvedSteps.length} of {requiredApprovals}{" "}
            {requiredApprovals === 1 ? "approval" : "approvals"}
          </Meta>
        }
      >
        <div className="max-w-[720px] space-y-5">
          {approvalRequest && approvalRequest.steps.length > 0 ? (
            <ol className="border-t border-hairline">
              {approvalRequest.steps.map((step) => (
                <li
                  key={step.id}
                  className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-hairline py-2.5 font-mono text-xs sm:grid-cols-[136px_1fr]"
                >
                  <time className="tabular-nums text-ink-muted">
                    {formatDateTime(step.createdAt)}
                  </time>
                  <div>
                    <span>
                      {step.actor.name} {step.decision}
                    </span>
                    <span className="text-ink-muted">
                      {" "}
                      — step {step.stepNumber} of {requiredApprovals} —{" "}
                      {step.actor.role}
                    </span>
                    <p className="mt-1 font-sans text-[13px] text-ink-muted">
                      {step.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {currentUser.role === "auditor" ? (
            <Notice label="Read-only">Auditors can’t make decisions.</Notice>
          ) : isClosed ? (
            <Notice label="Closed">
              This case was {kycCase.status}. No further changes are possible.
            </Notice>
          ) : (
            <>
              {capabilities.isSelfApprovalBlocked ? (
                <Notice label="Second reviewer">
                  You gave the first sign-off. A different reviewer must approve.
                </Notice>
              ) : !capabilities.canApprove &&
                kycCase.status === "pending_second_approval" ? (
                <Notice label="Second reviewer">
                  A senior reviewer or compliance admin must give the second sign-off.
                </Notice>
              ) : null}

              <div>
                <label htmlFor="decision-reason" className={labelClass}>
                  Reason
                </label>
                <textarea
                  id="decision-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What you reviewed and why"
                  className={inputClass}
                />
              </div>

              {actionError ? (
                <div role="alert">
                  <Notice label="Error" tone="danger">
                    {actionError}
                  </Notice>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {capabilities.canApprove ? (
                  <Button
                    variant="primary"
                    disabled={submitting}
                    onClick={() => void handleDecision("approved")}
                  >
                    {approveLabel}
                  </Button>
                ) : null}
                {capabilities.canEscalate ? (
                  <Button
                    disabled={submitting}
                    onClick={() => void handleDecision("escalated")}
                  >
                    Escalate
                  </Button>
                ) : null}
                {capabilities.canReject ? (
                  <Button
                    variant="danger"
                    disabled={submitting}
                    onClick={() => void handleDecision("rejected")}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Section>

      <Section
        index={5}
        title="Audit trail"
        aside={<Meta>
            {auditTrail.length} {auditTrail.length === 1 ? "event" : "events"}
          </Meta>}
      >
        <AuditTrail entries={auditTrail} />
      </Section>
    </div>
  );
}
