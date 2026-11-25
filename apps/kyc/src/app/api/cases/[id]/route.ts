import { NextRequest, NextResponse } from "next/server";
import { getLatestApprovalForEntity } from "@internal/platform/approvals";
import { getEntityAuditTrail } from "@internal/platform/audit";
import { getPrisma } from "@internal/platform/db";
import { assertCan, can } from "@internal/platform/permissions";
import { handleApiError } from "@internal/platform/http";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    assertCan(user, "read", { type: "kyc_case", id });

    const prisma = getPrisma();
    const kycCase = await prisma.kycCase.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true, role: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        sanctionsMatches: { orderBy: { matchScore: "desc" } },
      },
    });

    if (!kycCase) {
      return NextResponse.json({ error: "KYC case not found" }, { status: 404 });
    }

    const [approvalRequest, auditTrail, reviewers] = await Promise.all([
      getLatestApprovalForEntity(prisma, "KycCase", kycCase.id),
      can(user, "read", "audit_log")
        ? getEntityAuditTrail(prisma, "KycCase", kycCase.id)
        : Promise.resolve([]),
      prisma.user.findMany({
        where: { role: { in: ["analyst", "senior_reviewer", "compliance_admin"] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const firstApproval = approvalRequest?.steps.find(
      (s) => s.decision === "approved",
    );
    const isTerminal =
      kycCase.status === "approved" || kycCase.status === "rejected";

    const capabilities = {
      canClaim:
        !isTerminal &&
        !kycCase.assigneeId &&
        can(user, "assign", {
          type: "kyc_case",
          id: kycCase.id,
          assigneeId: kycCase.assigneeId,
          targetAssigneeId: user.id,
        }),
      canReassign:
        !isTerminal &&
        can(user, "assign", {
          type: "kyc_case",
          id: kycCase.id,
          assigneeId: kycCase.assigneeId ?? "other",
          targetAssigneeId: "other-reviewer",
        }),
      canApprove:
        !isTerminal &&
        can(user, "approve", {
          type: "approval_request",
          id: approvalRequest?.id ?? kycCase.id,
          riskScore: kycCase.riskScore,
          firstApproverId: firstApproval?.actorId ?? null,
        }),
      canReject: !isTerminal && can(user, "reject", "approval_request"),
      canEscalate: !isTerminal && can(user, "escalate", "approval_request"),
      canViewAudit: can(user, "read", "audit_log"),
      isSelfApprovalBlocked:
        Boolean(firstApproval) && firstApproval?.actorId === user.id,
    };

    return NextResponse.json({
      kycCase: {
        ...kycCase,
        assigneeName: kycCase.assignee?.name ?? "Unassigned",
      },
      approvalRequest,
      auditTrail,
      reviewers,
      capabilities,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
