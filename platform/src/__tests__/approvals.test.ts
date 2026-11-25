import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApprovalError,
  AuthorizationError,
  createApprovalRequest,
  createAuditedPrismaClient,
  createPrismaClient,
  getEntityAuditTrail,
  submitApprovalDecision,
  type SessionUser,
} from "../index";

describe("platform generic two-person approvals state machine", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-approvals-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const basePrisma = createPrismaClient(databaseUrl);
  const auditedPrisma = createAuditedPrismaClient(basePrisma);

  let analyst1: SessionUser;
  let analyst2: SessionUser;
  let senior: SessionUser;
  let auditor: SessionUser;

  beforeAll(async () => {
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

    const createdUsers = await Promise.all([
      basePrisma.user.create({
        data: {
          email: "analyst1@fintech.test",
          name: "Alex One",
          passwordHash: "hash",
          role: "analyst",
        },
      }),
      basePrisma.user.create({
        data: {
          email: "analyst2@fintech.test",
          name: "Alex Two",
          passwordHash: "hash",
          role: "analyst",
        },
      }),
      basePrisma.user.create({
        data: {
          email: "senior@fintech.test",
          name: "Sam Senior",
          passwordHash: "hash",
          role: "senior_reviewer",
        },
      }),
      basePrisma.user.create({
        data: {
          email: "auditor@fintech.test",
          name: "Avery Auditor",
          passwordHash: "hash",
          role: "auditor",
        },
      }),
    ]);

    analyst1 = {
      id: createdUsers[0].id,
      email: createdUsers[0].email,
      name: createdUsers[0].name,
      role: "analyst",
    };
    analyst2 = {
      id: createdUsers[1].id,
      email: createdUsers[1].email,
      name: createdUsers[1].name,
      role: "analyst",
    };
    senior = {
      id: createdUsers[2].id,
      email: createdUsers[2].email,
      name: createdUsers[2].name,
      role: "senior_reviewer",
    };
    auditor = {
      id: createdUsers[3].id,
      email: createdUsers[3].email,
      name: createdUsers[3].name,
      role: "auditor",
    };
  });

  afterAll(async () => {
    await basePrisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("approves low-risk requests in one step and syncs entity state via onTransition", async () => {
    const kycCase = await basePrisma.kycCase.create({
      data: {
        caseNumber: "KYC-APP-LOW",
        customerName: "Low Risk LLC",
        customerEmail: "low@test.com",
        country: "US",
        accountType: "individual",
        riskScore: 35,
        status: "in_review",
        slaDueAt: new Date(Date.now() + 3600_000),
      },
    });

    const req = await createApprovalRequest(auditedPrisma, analyst1, {
      entityType: "KycCase",
      entityId: kycCase.id,
      riskScore: kycCase.riskScore,
    });
    expect(req.requiredApprovals).toBe(1);
    expect(req.status).toBe("pending");

    const { request } = await submitApprovalDecision(auditedPrisma, analyst1, {
      approvalRequestId: req.id,
      decision: "approved",
      reason: "ID and proof of address verified",
      onTransition: async (tx, updated) => {
        await tx.kycCase.update({
          where: { id: updated.entityId },
          data: { status: updated.status },
        });
      },
    });

    expect(request.status).toBe("approved");
    expect(request.steps).toHaveLength(1);

    const updatedCase = await basePrisma.kycCase.findUnique({
      where: { id: kycCase.id },
    });
    expect(updatedCase?.status).toBe("approved");

    const auditTrail = await getEntityAuditTrail(basePrisma, "KycCase", kycCase.id);
    expect(auditTrail.some((e) => e.action === "approve")).toBe(true);
  });

  it("requires two-person sign-off above risk threshold and enforces role & separation of duties", async () => {
    const req = await createApprovalRequest(auditedPrisma, analyst1, {
      entityType: "KycCase",
      entityId: "high-risk-case-1",
      riskScore: 84,
    });
    expect(req.requiredApprovals).toBe(2);

    // Step 1 by analyst moves to pending_second_approval.
    const step1 = await submitApprovalDecision(auditedPrisma, analyst1, {
      approvalRequestId: req.id,
      decision: "approved",
      reason: "PEP hit cleared as false positive",
    });
    expect(step1.request.status).toBe("pending_second_approval");

    // Same analyst cannot self-approve step 2.
    await expect(
      submitApprovalDecision(auditedPrisma, analyst1, {
        approvalRequestId: req.id,
        decision: "approved",
        reason: "Self second approval attempt",
      }),
    ).rejects.toThrow(AuthorizationError);

    // Another analyst cannot approve high-risk step 2 (requires senior_reviewer+).
    await expect(
      submitApprovalDecision(auditedPrisma, analyst2, {
        approvalRequestId: req.id,
        decision: "approved",
        reason: "Peer analyst attempt",
      }),
    ).rejects.toThrow(AuthorizationError);

    // Senior reviewer completes second sign-off.
    const step2 = await submitApprovalDecision(auditedPrisma, senior, {
      approvalRequestId: req.id,
      decision: "approved",
      reason: "Confirmed source of funds and false-positive PEP match",
    });
    expect(step2.request.status).toBe("approved");
    expect(step2.request.steps).toHaveLength(2);

    // Finalized request rejects further decisions with 409.
    await expect(
      submitApprovalDecision(auditedPrisma, senior, {
        approvalRequestId: req.id,
        decision: "rejected",
        reason: "Too late",
      }),
    ).rejects.toThrow(ApprovalError);
  });

  it("blocks senior_reviewer from self-approving both steps, blocks auditor, and supports escalate/reject", async () => {
    await expect(
      createApprovalRequest(auditedPrisma, auditor, {
        entityType: "KycCase",
        entityId: "auditor-attempt",
        riskScore: 20,
      }),
    ).rejects.toThrow(AuthorizationError);

    const req = await createApprovalRequest(auditedPrisma, senior, {
      entityType: "KycCase",
      entityId: "senior-self-check",
      riskScore: 90,
    });

    await submitApprovalDecision(auditedPrisma, senior, {
      approvalRequestId: req.id,
      decision: "approved",
      reason: "First sign-off by senior",
    });

    await expect(
      submitApprovalDecision(auditedPrisma, senior, {
        approvalRequestId: req.id,
        decision: "approved",
        reason: "Senior self second sign-off",
      }),
    ).rejects.toThrow(AuthorizationError);

    // Escalate and then reject works cleanly, and empty reason is rejected with 400.
    await expect(
      submitApprovalDecision(auditedPrisma, analyst1, {
        approvalRequestId: req.id,
        decision: "escalated",
        reason: "   ",
      }),
    ).rejects.toThrow(ApprovalError);

    const escalated = await submitApprovalDecision(auditedPrisma, analyst1, {
      approvalRequestId: req.id,
      decision: "escalated",
      reason: "Needs legal review on sanctions hit",
    });
    expect(escalated.request.status).toBe("escalated");

    const rejected = await submitApprovalDecision(auditedPrisma, senior, {
      approvalRequestId: req.id,
      decision: "rejected",
      reason: "Confirmed OFAC match",
    });
    expect(rejected.request.status).toBe("rejected");
  });
});
