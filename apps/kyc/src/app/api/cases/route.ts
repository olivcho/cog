import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@internal/platform/db";
import { assertCan } from "@internal/platform/permissions";
import { HIGH_RISK_THRESHOLD } from "@internal/platform/types";
import { handleApiError } from "@internal/platform/http";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    assertCan(user, "read", "kyc_case");

    const params = request.nextUrl.searchParams;
    const status = params.get("status")?.trim() || undefined;
    const riskTier = params.get("riskTier")?.trim() || undefined;
    const assignee = params.get("assignee")?.trim() || undefined;
    const sla = params.get("sla")?.trim() || undefined;
    const search = params.get("search")?.trim() || undefined;

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }

    if (riskTier === "high") {
      where.riskScore = { gte: HIGH_RISK_THRESHOLD };
    } else if (riskTier === "medium") {
      where.riskScore = { gte: 40, lt: HIGH_RISK_THRESHOLD };
    } else if (riskTier === "low") {
      where.riskScore = { lt: 40 };
    }

    if (assignee === "me") {
      where.assigneeId = user.id;
    } else if (assignee === "unassigned") {
      where.assigneeId = null;
    } else if (assignee && assignee !== "all") {
      where.assigneeId = assignee;
    }

    const now = new Date();
    if (sla === "breached") {
      where.slaDueAt = { lt: now };
      where.status = status && status !== "all"
        ? status
        : { notIn: ["approved", "rejected"] };
    } else if (sla === "urgent") {
      where.slaDueAt = { gte: now, lte: new Date(now.getTime() + 4 * 3600_000) };
      where.status = status && status !== "all"
        ? status
        : { notIn: ["approved", "rejected"] };
    }

    if (search) {
      where.OR = [
        { caseNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { country: { contains: search } },
      ];
    }

    const prisma = getPrisma();
    const [cases, allCasesForStats, reviewers] = await Promise.all([
      prisma.kycCase.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { documents: true, sanctionsMatches: true } },
        },
        orderBy: [{ slaDueAt: "asc" }],
      }),
      prisma.kycCase.findMany({
        select: { status: true, riskScore: true, slaDueAt: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["analyst", "senior_reviewer", "compliance_admin"] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const stats = {
      total: allCasesForStats.length,
      open: allCasesForStats.filter(
        (c) => c.status === "open" || c.status === "in_review",
      ).length,
      pendingSecondApproval: allCasesForStats.filter(
        (c) => c.status === "pending_second_approval",
      ).length,
      highRiskActive: allCasesForStats.filter(
        (c) =>
          c.riskScore >= HIGH_RISK_THRESHOLD &&
          c.status !== "approved" &&
          c.status !== "rejected",
      ).length,
      slaBreached: allCasesForStats.filter(
        (c) =>
          c.slaDueAt < now &&
          c.status !== "approved" &&
          c.status !== "rejected",
      ).length,
    };

    const items = cases.map((c) => ({
      ...c,
      assigneeName: c.assignee?.name ?? "Unassigned",
    }));

    return NextResponse.json({ cases: items, stats, reviewers });
  } catch (err) {
    return handleApiError(err);
  }
}
