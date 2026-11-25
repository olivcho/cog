"use client";

import { useCallback, useEffect, useState } from "react";
import { HIGH_RISK_THRESHOLD, type SessionUser } from "@internal/platform/types";
import { SlaBadge } from "@internal/platform/ui";

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

const UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

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
        setError(data.error ?? "Failed to load case");
        return;
      }
      setDetail(data);
      setSelectedDocId((prev) =>
        prev && data.kycCase.documents.some((d) => d.id === prev)
          ? prev
          : (data.kycCase.documents[0]?.id ?? null),
      );
    } catch {
      setError("Network error while loading case");
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
        setActionError(data.error ?? "Assignment failed");
        return;
      }
      await loadDetail();
      onMutated();
    } catch {
      setActionError("Network error while assigning case");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(
    decision: "approved" | "rejected" | "escalated",
  ) {
    setActionError(null);
    if (!reason.trim()) {
      setActionError("Please enter a decision reason for the audit trail.");
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
        setActionError(data.error ?? "Decision failed");
        return;
      }
      setReason("");
      await loadDetail();
      onMutated();
    } catch {
      setActionError("Network error while recording decision");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading case details...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Case unavailable"}
      </div>
    );
  }

  const { kycCase, approvalRequest, auditTrail, reviewers, capabilities } = detail;
  const isHighRisk = kycCase.riskScore >= HIGH_RISK_THRESHOLD;
  const approvedSteps =
    approvalRequest?.steps.filter((s) => s.decision === "approved") ?? [];
  const requiredApprovals = isHighRisk ? 2 : 1;
  const selectedDoc =
    kycCase.documents.find((d) => d.id === selectedDocId) ??
    kycCase.documents[0] ??
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Back to Queue
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {capabilities.canClaim ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleAssign(currentUser.id)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Claim Case
            </button>
          ) : null}

          {capabilities.canReassign ? (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span>Assign:</span>
              <select
                disabled={submitting}
                value={kycCase.assigneeId ?? ""}
                onChange={(e) =>
                  void handleAssign(e.target.value ? e.target.value : null)
                }
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="">Unassigned</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role.replace("_", " ")})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {/* Case Summary Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">
                {kycCase.caseNumber}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {kycCase.status.replace(/_/g, " ")}
              </span>
              <SlaBadge
                dueAt={kycCase.slaDueAt}
                closed={kycCase.status === "approved" || kycCase.status === "rejected"}
              />
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {kycCase.customerName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {kycCase.customerEmail} · {kycCase.country} ·{" "}
              {kycCase.accountType} · Assignee:{" "}
              <strong className="text-slate-700">{kycCase.assigneeName}</strong>
            </p>
            {kycCase.summary ? (
              <p className="mt-3 max-w-3xl text-sm text-slate-700">
                {kycCase.summary}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Risk Score
            </div>
            <div
              className={`mt-0.5 text-2xl font-bold tabular-nums ${
                isHighRisk
                  ? "text-red-600"
                  : kycCase.riskScore >= 40
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {kycCase.riskScore} / 100
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {isHighRisk
                ? `Two-person sign-off (>=${HIGH_RISK_THRESHOLD})`
                : "Single-approver eligible"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document Viewer */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Document Viewer ({kycCase.documents.length})
            </h3>
            <span className="text-xs text-slate-500">OCR Extraction</span>
          </div>

          {kycCase.documents.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No documents uploaded for this case.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {kycCase.documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      selectedDoc?.id === doc.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {doc.docType.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              {selectedDoc ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium text-slate-800">
                      {selectedDoc.fileName}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        selectedDoc.status === "verified"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : selectedDoc.status === "flagged"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {selectedDoc.status}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
                    {Object.entries(safeParseJson(selectedDoc.extractedJson)).map(
                      ([k, v]) => (
                        <div key={k}>
                          <dt className="text-[11px] font-medium uppercase text-slate-500">
                            {k.replace(/([A-Z])/g, " $1")}
                          </dt>
                          <dd className="text-xs font-medium text-slate-900">
                            {String(v)}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* Mock Sanctions & PEP Matches */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Sanctions &amp; PEP Screening ({kycCase.sanctionsMatches.length})
            </h3>
            <span className="text-xs text-slate-500">OFAC · EU · UN · PEP</span>
          </div>

          {kycCase.sanctionsMatches.length === 0 ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-800">
              No sanctions, PEP, or adverse media hits detected.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {kycCase.sanctionsMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-lg border border-slate-200 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                        {match.listName}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {match.category.toUpperCase()}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        match.matchScore >= 80
                          ? "text-red-600"
                          : match.matchScore >= 60
                            ? "text-amber-700"
                            : "text-slate-600"
                      }`}
                    >
                      {match.matchScore}% match
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {match.matchedName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{match.details}</p>
                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    Disposition:{" "}
                    <span className="text-slate-800">
                      {match.disposition.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Approval State Machine & Decision Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Approval Workflow ({approvedSteps.length} / {requiredApprovals}{" "}
              approvals)
            </h3>
            <p className="text-xs text-slate-500">
              Enforced via <code className="font-mono">can(user, action, resource)</code> and the generic platform approvals state machine.
            </p>
          </div>
        </div>

        {approvalRequest && approvalRequest.steps.length > 0 ? (
          <ol className="mt-4 space-y-2">
            {approvalRequest.steps.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">
                    Step {step.stepNumber}: {step.decision.toUpperCase()}
                  </span>{" "}
                  by <span className="font-medium">{step.actor.name}</span> (
                  <span className="font-mono text-slate-600">
                    {step.actor.role}
                  </span>
                  )
                  <p className="mt-0.5 text-slate-600">{step.reason}</p>
                </div>
                <time className="tabular-nums text-slate-500">
                  {UTC_FORMATTER.format(new Date(step.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : null}

        {currentUser.role === "auditor" ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <strong>Read-Only Auditor View:</strong> Decision actions are hidden for auditors and rejected with <code className="font-mono">403 Forbidden</code> at the API layer.
          </div>
        ) : kycCase.status === "approved" || kycCase.status === "rejected" ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            This case is finalized (<strong>{kycCase.status}</strong>). No further transitions are permitted.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {capabilities.isSelfApprovalBlocked ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Separation of duties:</strong> You submitted Step 1 approval. A different <code className="font-mono">senior_reviewer</code> or <code className="font-mono">compliance_admin</code> must submit Step 2.
              </div>
            ) : !capabilities.canApprove &&
              kycCase.status === "pending_second_approval" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>High-risk Step 2 restricted:</strong> Requires <code className="font-mono">senior_reviewer</code> or <code className="font-mono">compliance_admin</code>.
              </div>
            ) : null}

            <div>
              <label
                htmlFor="decision-reason"
                className="block text-xs font-medium text-slate-700"
              >
                Decision Reason (required, recorded in append-only audit log)
              </label>
              <textarea
                id="decision-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Document evidence reviewed, sanctions disposition, or escalation rationale..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {actionError ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {actionError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {capabilities.canApprove ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleDecision("approved")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isHighRisk && approvedSteps.length === 0
                    ? "Submit 1st Sign-Off"
                    : isHighRisk && approvedSteps.length === 1
                      ? "Submit 2nd Sign-Off (Final Approve)"
                      : "Approve Case"}
                </button>
              ) : null}

              {capabilities.canEscalate ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleDecision("escalated")}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Escalate
                </button>
              ) : null}

              {capabilities.canReject ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleDecision("rejected")}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Case
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* Per-Case Append-Only Audit Trail */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Per-Case Append-Only Audit Trail ({auditTrail.length})
          </h3>
          <span className="text-xs text-slate-500">Immutable · Auto-logged</span>
        </div>

        {auditTrail.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No audit events recorded yet.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-slate-100">
            {auditTrail.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-xs"
              >
                <div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                    {entry.action}
                  </span>{" "}
                  <span className="text-slate-500">by</span>{" "}
                  <span className="font-mono text-slate-700">
                    {entry.actorEmail}
                  </span>
                  {entry.reason ? (
                    <p className="mt-1 text-slate-600">{entry.reason}</p>
                  ) : null}
                </div>
                <time className="tabular-nums text-slate-500">
                  {UTC_FORMATTER.format(new Date(entry.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
