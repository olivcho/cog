import type { Prisma, PrismaClient } from "@prisma/client";
import {
  runAuditedTransaction,
  type AuditedPrismaClient,
} from "../audit/client";
import { assertCan } from "../permissions/rbac";
import {
  HIGH_RISK_THRESHOLD,
  type ApprovalDecision,
  type ApprovalStatus,
  type SessionUser,
} from "../types";

const TERMINAL_STATUSES = new Set<string>(["approved", "rejected"]);

export class ApprovalError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "ApprovalError";
    this.statusCode = statusCode;
  }
}

export function requiredApprovalsForRisk(
  riskScore: number,
  threshold: number = HIGH_RISK_THRESHOLD,
): 1 | 2 {
  return riskScore >= threshold ? 2 : 1;
}

export interface CreateApprovalInput {
  entityType: string;
  entityId: string;
  riskScore: number;
  threshold?: number;
  reason?: string;
}

export async function createApprovalRequest(
  auditedClient: AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  input: CreateApprovalInput,
) {
  assertCan(actor, "create", "approval_request");

  if (
    !Number.isFinite(input.riskScore) ||
    input.riskScore < 0 ||
    input.riskScore > 100
  ) {
    throw new ApprovalError("riskScore must be between 0 and 100", 400);
  }

  const requiredApprovals = requiredApprovalsForRisk(
    input.riskScore,
    input.threshold,
  );

  return runAuditedTransaction(
    auditedClient,
    {
      actor,
      reason: input.reason ?? "Created approval request",
    },
    async (tx) => {
      return tx.approvalRequest.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          status: "pending",
          requiredApprovals,
          riskScore: input.riskScore,
          createdById: actor.id,
        },
        include: { steps: true },
      });
    },
  );
}

export interface SubmitApprovalDecisionInput {
  approvalRequestId: string;
  decision: ApprovalDecision;
  reason: string;
  onTransition?: (
    tx: Prisma.TransactionClient,
    updated: { id: string; status: ApprovalStatus; entityType: string; entityId: string },
  ) => Promise<void>;
}

const ACTION_BY_DECISION = {
  approved: "approve",
  rejected: "reject",
  escalated: "escalate",
} as const;

export async function submitApprovalDecision(
  auditedClient: AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  input: SubmitApprovalDecisionInput,
) {
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    throw new ApprovalError("A decision reason is required", 400);
  }

  return runAuditedTransaction(
    auditedClient,
    {
      actor,
      reason: trimmedReason,
      actionOverride: ACTION_BY_DECISION[input.decision],
    },
    async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id: input.approvalRequestId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
          },
        },
      });

      if (!existing) {
        throw new ApprovalError("Approval request not found", 404);
      }

      if (TERMINAL_STATUSES.has(existing.status)) {
        throw new ApprovalError(
          `Approval request is already finalized (${existing.status})`,
          409,
        );
      }

      const priorApprovals = existing.steps.filter(
        (step) => step.decision === "approved",
      );
      const firstApproval = priorApprovals[0];

      if (input.decision === "approved") {
        assertCan(actor, "approve", {
          type: "approval_request",
          id: existing.id,
          riskScore: existing.riskScore,
          firstApproverId: firstApproval?.actorId ?? null,
        });
      } else {
        assertCan(actor, ACTION_BY_DECISION[input.decision], "approval_request");
      }

      let nextStatus: ApprovalStatus;
      if (input.decision === "rejected") {
        nextStatus = "rejected";
      } else if (input.decision === "escalated") {
        nextStatus = "escalated";
      } else {
        const approvalCount = priorApprovals.length + 1;
        nextStatus =
          approvalCount >= existing.requiredApprovals
            ? "approved"
            : "pending_second_approval";
      }

      const nextStepNumber = existing.steps.length + 1;

      const step = await tx.approvalStep.create({
        data: {
          approvalRequestId: existing.id,
          stepNumber: nextStepNumber,
          actorId: actor.id,
          decision: input.decision,
          reason: trimmedReason,
        },
      });

      const updated = await tx.approvalRequest.update({
        where: { id: existing.id },
        data: { status: nextStatus },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: {
              actor: {
                select: { id: true, email: true, name: true, role: true },
              },
            },
          },
        },
      });

      if (input.onTransition) {
        await input.onTransition(tx, {
          id: updated.id,
          status: nextStatus,
          entityType: updated.entityType,
          entityId: updated.entityId,
        });
      }

      return { request: updated, step };
    },
  );
}

export async function getApprovalRequest(
  client: PrismaClient | AuditedPrismaClient,
  id: string,
) {
  return client.approvalRequest.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: {
          actor: {
            select: { id: true, email: true, name: true, role: true },
          },
        },
      },
    },
  });
}

export async function getLatestApprovalForEntity(
  client: PrismaClient | AuditedPrismaClient,
  entityType: string,
  entityId: string,
) {
  return client.approvalRequest.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: {
          actor: {
            select: { id: true, email: true, name: true, role: true },
          },
        },
      },
    },
  });
}
