import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authenticateCredentials,
  createAuditedPrismaClient,
  createPrismaClient,
  DEMO_ACCOUNTS,
  getLatestApprovalForEntity,
  seedDemoData,
  submitApprovalDecision,
  type SessionUser,
} from "../index";

describe("KYC demo seed and end-to-end two-person workflow", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-seed-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const basePrisma = createPrismaClient(databaseUrl);
  const auditedPrisma = createAuditedPrismaClient(basePrisma);

  beforeAll(() => {
    const platformDir = path.resolve(__dirname, "../..");
    execFileSync(
      "npx",
      ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
      {
        cwd: platformDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      },
    );
  });

  afterAll(async () => {
    await basePrisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("seeds 4 personas and 12 cases idempotently and supports Step 2 senior approval", async () => {
    const first = await seedDemoData(basePrisma);
    expect(first.users).toBe(4);
    expect(first.cases).toBe(12);

    // Running again is a no-op.
    const second = await seedDemoData(basePrisma);
    expect(second.cases).toBe(0);

    // Every seeded demo account authenticates cleanly.
    for (const account of DEMO_ACCOUNTS) {
      const authed = await authenticateCredentials(
        basePrisma,
        account.email,
        account.password,
      );
      expect(authed?.role).toBe(account.role);
    }

    // Seeded high-risk case KYC-2026-1001 is pending_second_approval with Step 1 by analyst.
    const meridian = await basePrisma.kycCase.findUnique({
      where: { caseNumber: "KYC-2026-1001" },
      include: { documents: true, sanctionsMatches: true },
    });
    expect(meridian?.status).toBe("pending_second_approval");
    expect(meridian?.documents.length).toBeGreaterThanOrEqual(2);
    expect(meridian?.sanctionsMatches.length).toBeGreaterThanOrEqual(1);

    const approval = await getLatestApprovalForEntity(
      basePrisma,
      "KycCase",
      meridian!.id,
    );
    expect(approval?.requiredApprovals).toBe(2);
    expect(approval?.steps).toHaveLength(1);

    const seniorAccount = DEMO_ACCOUNTS.find(
      (a) => a.email === "senior@fintech.demo",
    )!;
    const seniorUser = (await authenticateCredentials(
      basePrisma,
      seniorAccount.email,
      seniorAccount.password,
    )) as SessionUser;

    const completed = await submitApprovalDecision(auditedPrisma, seniorUser, {
      approvalRequestId: approval!.id,
      decision: "approved",
      reason: "Senior second sign-off verified",
      onTransition: async (tx, updated) => {
        await tx.kycCase.update({
          where: { id: meridian!.id },
          data: { status: updated.status },
        });
      },
    });
    expect(completed.request.status).toBe("approved");

    const updatedMeridian = await basePrisma.kycCase.findUnique({
      where: { id: meridian!.id },
    });
    expect(updatedMeridian?.status).toBe("approved");
  });
});
