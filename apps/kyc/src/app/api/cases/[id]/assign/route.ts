import { NextRequest, NextResponse } from "next/server";
import { withAuditContext } from "@internal/platform/audit";
import { getPrisma } from "@internal/platform/db";
import { assertCan } from "@internal/platform/permissions";
import { handleApiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/csrf";
import { getAuditedPrisma } from "@/lib/audited-prisma";

export const dynamic = "force-dynamic";

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
      assigneeId?: string | null;
      reason?: string;
    } | null;

    if (!body || !("assigneeId" in body)) {
      return NextResponse.json(
        { error: "assigneeId is required" },
        { status: 400 },
      );
    }

    const targetAssigneeId =
      body.assigneeId === null ? null : String(body.assigneeId);

    const prisma = getPrisma();
    const existing = await prisma.kycCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "KYC case not found" }, { status: 404 });
    }

    if (existing.status === "approved" || existing.status === "rejected") {
      return NextResponse.json(
        { error: "Cannot reassign a finalized case" },
        { status: 409 },
      );
    }

    assertCan(user, "assign", {
      type: "kyc_case",
      id: existing.id,
      assigneeId: existing.assigneeId,
      targetAssigneeId,
    });

    if (targetAssigneeId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetAssigneeId },
        select: { id: true, role: true },
      });
      if (!targetUser || targetUser.role === "auditor") {
        return NextResponse.json(
          { error: "Assignee must be an active reviewer" },
          { status: 400 },
        );
      }
    }

    const nextStatus =
      targetAssigneeId && existing.status === "open"
        ? "in_review"
        : existing.status;

    const auditedPrisma = getAuditedPrisma();
    const updated = await withAuditContext(
      {
        actor: user,
        actionOverride: "assign",
        reason:
          body.reason?.trim() ||
          (targetAssigneeId === user.id
            ? "Claimed case from queue"
            : targetAssigneeId
              ? "Reassigned case to reviewer"
              : "Unassigned case"),
      },
      () =>
        auditedPrisma.kycCase.update({
          where: { id: existing.id },
          data: {
            assigneeId: targetAssigneeId,
            status: nextStatus,
          },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        }),
    );

    return NextResponse.json({ kycCase: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
