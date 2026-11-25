import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuditImmutabilityError,
  createAuditedPrismaClient,
  createPrismaClient,
  getEntityAuditTrail,
  runAuditedTransaction,
  withAuditContext,
  type SessionUser,
} from "../index";

describe("platform automatic append-only audit trail", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-audit-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const basePrisma = createPrismaClient(databaseUrl);
  const auditedPrisma = createAuditedPrismaClient(basePrisma);

  let actor: SessionUser;

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

    const dbUser = await basePrisma.user.create({
      data: {
        email: "compliance@fintech.test",
        name: "Casey Compliance",
        passwordHash: "scrypt$salt$secret",
        role: "compliance_admin",
      },
    });
    actor = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: "compliance_admin",
    };
  });

  afterAll(async () => {
    await basePrisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("automatically records create, update, and delete with before/after snapshots", async () => {
    const created = await withAuditContext(
      { actor, reason: "Opened new KYC case" },
      () =>
        auditedPrisma.kycCase.create({
          data: {
            caseNumber: "KYC-AUDIT-001",
            customerName: "Northstar Ventures",
            customerEmail: "ops@northstar.test",
            country: "US",
            accountType: "business",
            riskScore: 42,
            status: "open",
            slaDueAt: new Date(Date.now() + 3600_000),
          },
        }),
    );

    await withAuditContext({ actor, reason: "Claimed case for review" }, () =>
      auditedPrisma.kycCase.update({
        where: { id: created.id },
        data: { status: "in_review", assigneeId: actor.id },
      }),
    );

    await withAuditContext({ actor, reason: "Removed duplicate test case" }, () =>
      auditedPrisma.kycCase.delete({
        where: { id: created.id },
      }),
    );

    const trail = await getEntityAuditTrail(basePrisma, "KycCase", created.id);
    expect(trail).toHaveLength(3);

    const actions = trail.map((entry) => entry.action);
    expect(actions).toContain("create");
    expect(actions).toContain("update");
    expect(actions).toContain("delete");

    const updateEntry = trail.find((e) => e.action === "update");
    expect(updateEntry?.actorId).toBe(actor.id);
    expect(updateEntry?.actorEmail).toBe(actor.email);
    expect(updateEntry?.reason).toBe("Claimed case for review");
    expect(JSON.parse(updateEntry?.beforeJson ?? "{}").status).toBe("open");
    expect(JSON.parse(updateEntry?.afterJson ?? "{}").status).toBe("in_review");

    const deleteEntry = trail.find((e) => e.action === "delete");
    expect(JSON.parse(deleteEntry?.beforeJson ?? "{}").status).toBe("in_review");
    expect(deleteEntry?.afterJson).toBeNull();
  });

  it("redacts sensitive fields such as passwordHash before persisting audit snapshots", async () => {
    const user = await withAuditContext({ actor }, () =>
      auditedPrisma.user.create({
        data: {
          email: "new-analyst@fintech.test",
          name: "New Analyst",
          passwordHash: "scrypt$supersecret$hashvalue",
          role: "analyst",
        },
      }),
    );

    const trail = await getEntityAuditTrail(basePrisma, "User", user.id);
    expect(trail).toHaveLength(1);
    const snapshot = JSON.parse(trail[0]?.afterJson ?? "{}");
    expect(snapshot.passwordHash).toBe("[REDACTED]");
    expect(trail[0]?.afterJson).not.toContain("supersecret");
  });

  it("blocks update and delete operations on AuditLog (append-only)", async () => {
    const entry = await basePrisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "create",
        entityType: "KycCase",
        entityId: "immutable-case",
      },
    });

    await expect(
      auditedPrisma.auditLog.update({
        where: { id: entry.id },
        data: { reason: "tampered" },
      }),
    ).rejects.toThrow(AuditImmutabilityError);

    await expect(
      auditedPrisma.auditLog.delete({
        where: { id: entry.id },
      }),
    ).rejects.toThrow(AuditImmutabilityError);

    await expect(
      auditedPrisma.auditLog.deleteMany({
        where: { id: entry.id },
      }),
    ).rejects.toThrow(AuditImmutabilityError);
  });

  it("rolls back audit log entries when an audited transaction fails", async () => {
    const caseNumber = "KYC-ROLLBACK-001";
    await expect(
      runAuditedTransaction(
        auditedPrisma,
        { actor, reason: "Should roll back" },
        async (tx) => {
          await tx.kycCase.create({
            data: {
              caseNumber,
              customerName: "Rollback Corp",
              customerEmail: "rb@test.com",
              country: "US",
              accountType: "business",
              riskScore: 30,
              status: "open",
              slaDueAt: new Date(Date.now() + 3600_000),
            },
          });
          throw new Error("Simulated failure");
        },
      ),
    ).rejects.toThrow("Simulated failure");

    const foundCase = await basePrisma.kycCase.findUnique({
      where: { caseNumber },
    });
    expect(foundCase).toBeNull();

    const leakedAudit = await basePrisma.auditLog.findFirst({
      where: { reason: "Should roll back" },
    });
    expect(leakedAudit).toBeNull();
  });
});
