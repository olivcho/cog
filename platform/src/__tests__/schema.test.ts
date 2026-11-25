import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, HIGH_RISK_THRESHOLD, ROLES } from "../index";
import { loadWorkspaceEnv } from "../db/env";

describe("platform database schema smoke test", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-schema-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const prisma = createPrismaClient(databaseUrl);

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
    await prisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports expected roles and risk threshold", () => {
    expect(ROLES).toEqual([
      "analyst",
      "senior_reviewer",
      "compliance_admin",
      "auditor",
    ]);
    expect(HIGH_RISK_THRESHOLD).toBe(70);
  });

  it("persists core platform and KYC domain records with relations", async () => {
    const analyst = await prisma.user.create({
      data: {
        email: "analyst@fintech.test",
        name: "Alex Analyst",
        passwordHash: "placeholder-hash",
        role: "analyst",
      },
    });

    const kycCase = await prisma.kycCase.create({
      data: {
        caseNumber: "KYC-2026-0001",
        customerName: "Meridian Holdings Ltd",
        customerEmail: "ops@meridian.test",
        country: "GB",
        accountType: "business",
        riskScore: 82,
        status: "open",
        slaDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        assigneeId: analyst.id,
        documents: {
          create: {
            docType: "corporate_filing",
            fileName: "meridian-inc.pdf",
            status: "pending",
            extractedJson: JSON.stringify({ regNo: "UK-991022" }),
          },
        },
        sanctionsMatches: {
          create: {
            listName: "PEP_GLOBAL",
            matchedName: "Meridian Holdings",
            matchScore: 78,
            category: "pep",
            details: "Director listed as former regional official",
          },
        },
      },
      include: {
        documents: true,
        sanctionsMatches: true,
        assignee: true,
      },
    });

    const approval = await prisma.approvalRequest.create({
      data: {
        entityType: "KycCase",
        entityId: kycCase.id,
        status: "pending_second_approval",
        requiredApprovals: 2,
        riskScore: kycCase.riskScore,
        createdById: analyst.id,
        steps: {
          create: {
            stepNumber: 1,
            actorId: analyst.id,
            decision: "approved",
            reason: "Initial review completed; escalated for second sign-off",
          },
        },
      },
      include: { steps: true },
    });

    const audit = await prisma.auditLog.create({
      data: {
        actorId: analyst.id,
        actorEmail: analyst.email,
        action: "create",
        entityType: "KycCase",
        entityId: kycCase.id,
        afterJson: JSON.stringify({ caseNumber: kycCase.caseNumber }),
      },
    });

    expect(kycCase.assignee?.email).toBe("analyst@fintech.test");
    expect(kycCase.documents).toHaveLength(1);
    expect(kycCase.sanctionsMatches).toHaveLength(1);
    expect(approval.steps).toHaveLength(1);
    expect(audit.entityId).toBe(kycCase.id);
  });

  it("loads DATABASE_URL from workspace .env without overriding explicit env", () => {
    const envPath = path.join(tempDir, ".env");
    fs.writeFileSync(
      envPath,
      [
        "# comment",
        'DATABASE_URL="file:./first.db"',
        'DATABASE_URL="postgresql://user:pass@localhost:5432/app" # inline comment',
        "SESSION_SECRET=abc",
      ].join("\n"),
    );

    const emptyEnv: Record<string, string | undefined> = {};
    loadWorkspaceEnv(envPath, emptyEnv);
    expect(emptyEnv.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/app");
    expect(emptyEnv.SESSION_SECRET).toBe("abc");

    const explicitEnv: Record<string, string | undefined> = {
      DATABASE_URL: "file:./override.db",
    };
    loadWorkspaceEnv(envPath, explicitEnv);
    expect(explicitEnv.DATABASE_URL).toBe("file:./override.db");
    expect(explicitEnv.SESSION_SECRET).toBe("abc");
  });
});
