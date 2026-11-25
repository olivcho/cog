import { NextRequest, NextResponse } from "next/server";
import {
  createApprovalRequest,
  getLatestApprovalForEntity,
  submitApprovalDecision,
} from "@internal/platform/approvals";
import { getPrisma } from "@internal/platform/db";
import type { ApprovalDecision } from "@internal/platform/types";
import { handleApiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/csrf";
import { getAuditedPrisma } from "@/lib/audited-prisma";

export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set<ApprovalDecision>([
  "approved",
  "rejected",
  "escalated",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = validateSameOrigin(request, {
    requireJson: true,
  });
  if (csrfError) return csrfError;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      decision?: string;
      reason?: string;
    } | null;

    if (
      !body?.decision ||
      !VALID_DECISIONS.has(body.decision as ApprovalDecision)
    ) {
      return NextResponse.json(
        { error: "decision must be approved, rejected, or escalated" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const kycCase = await prisma.kycCase.findUnique({ where: { id } });
    if (!kycCase) {
      return NextResponse.json({ error: "KYC case not found" }, { status: 404 });
    }

    const auditedPrisma = getAuditedPrisma();
    let approval = await getLatestApprovalForEntity(
      prisma,
      "KycCase",
      kycCase.id,
    );

    if (!approval) {
      const created = await createApprovalRequest(auditedPrisma, user, {
        entityType: "KycCase",
        entityId: kycCase.id,
        riskScore: kycCase.riskScore,
        reason: `Initiated approval workflow for ${kycCase.caseNumber}`,
      });
      approval = await getLatestApprovalForEntity(
        prisma,
        "KycCase",
        kycCase.id,
      );
      if (!approval) {
        return NextResponse.json(
          { error: `Approval request ${created.id} unavailable` },
          { status: 500 },
        );
      }
    }

    const result = await submitApprovalDecision(auditedPrisma, user, {
      approvalRequestId: approval.id,
      decision: body.decision as ApprovalDecision,
      reason: body.reason ?? "",
      onTransition: async (tx, updatedRequest) => {
        await tx.kycCase.update({
          where: { id: kycCase.id },
          data: { status: updatedRequest.status },
        });
      },
    });

    return NextResponse.json({
      approvalRequest: result.request,
      step: result.step,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
