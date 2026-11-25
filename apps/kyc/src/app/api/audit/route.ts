import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@internal/platform/db";
import { assertCan } from "@internal/platform/permissions";
import { handleApiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    assertCan(user, "read", "audit_log");

    const params = request.nextUrl.searchParams;
    const entityId = params.get("entityId")?.trim() || undefined;
    const entityType = params.get("entityType")?.trim() || undefined;
    const action = params.get("action")?.trim() || undefined;

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (entityType) where.entityType = entityType;
    if (action && action !== "all") where.action = action;

    const prisma = getPrisma();
    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ entries });
  } catch (err) {
    return handleApiError(err);
  }
}
