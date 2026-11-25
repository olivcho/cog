import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuthorizationError,
  clearModelRegistry,
  createAuditedPrismaClient,
  createPrismaClient,
  defineModel,
  deleteModelRecord,
  getEntityAuditTrail,
  getModel,
  getModelRecord,
  listModelRecords,
  listModels,
  ModelError,
  updateModelRecord,
  type SessionUser,
} from "../index";

describe("platform model-driven views (defineModel + permission/audit loaders)", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-models-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const basePrisma = createPrismaClient(databaseUrl);
  const auditedPrisma = createAuditedPrismaClient(basePrisma);

  let analyst: SessionUser;
  let admin: SessionUser;
  let auditor: SessionUser;
  let seededCaseId: string;

  const kycModel = defineModel({
    name: "kyc_case_test",
    label: "KYC Case",
    pluralLabel: "KYC Cases",
    prismaModel: "kycCase",
    auditEntityType: "KycCase",
    resource: "kyc_case",
    defaultSort: { field: "riskScore", direction: "desc" },
    searchableFields: ["caseNumber", "customerName", "customerEmail"],
    editableFields: ["summary", "status"],
    fields: [
      { key: "caseNumber", label: "Case #", type: "string", sortable: true },
      { key: "customerName", label: "Customer", type: "string", sortable: true },
      {
        key: "customerEmail",
        label: "Email",
        type: "email",
        allowedRoles: ["compliance_admin", "senior_reviewer"],
        filterable: true,
      },
      { key: "country", label: "Country", type: "string", filterable: true },
      {
        key: "riskScore",
        label: "Risk Score",
        type: "risk_score",
        sortable: true,
      },
      { key: "status", label: "Status", type: "badge", filterable: true },
      { key: "summary", label: "Summary", type: "string", detailOnly: true },
      { key: "slaDueAt", label: "SLA Due", type: "date", sortable: true },
    ],
    listColumns: ["caseNumber", "customerName", "customerEmail", "riskScore", "status"],
  });

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

    const [u1, u2, u3] = await Promise.all([
      basePrisma.user.create({
        data: {
          email: "analyst@models.test",
          name: "Alex Analyst",
          passwordHash: "hash",
          role: "analyst",
        },
      }),
      basePrisma.user.create({
        data: {
          email: "admin@models.test",
          name: "Casey Admin",
          passwordHash: "hash",
          role: "compliance_admin",
        },
      }),
      basePrisma.user.create({
        data: {
          email: "auditor@models.test",
          name: "Avery Auditor",
          passwordHash: "hash",
          role: "auditor",
        },
      }),
    ]);

    analyst = { id: u1.id, email: u1.email, name: u1.name, role: "analyst" };
    admin = {
      id: u2.id,
      email: u2.email,
      name: u2.name,
      role: "compliance_admin",
    };
    auditor = { id: u3.id, email: u3.email, name: u3.name, role: "auditor" };

    const c1 = await basePrisma.kycCase.create({
      data: {
        caseNumber: "KYC-M-001",
        customerName: "Apex Treasury Ltd",
        customerEmail: "secret@apex.test",
        country: "GB",
        accountType: "business",
        riskScore: 82,
        status: "open",
        slaDueAt: new Date(Date.now() + 3600_000),
      },
    });
    seededCaseId = c1.id;

    await basePrisma.kycCase.create({
      data: {
        caseNumber: "KYC-M-002",
        customerName: "Beacon Retail Inc",
        customerEmail: "ops@beacon.test",
        country: "US",
        accountType: "business",
        riskScore: 28,
        status: "in_review",
        slaDueAt: new Date(Date.now() + 7200_000),
      },
    });
  });

  afterAll(async () => {
    clearModelRegistry();
    await basePrisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers models and rejects invalid model definitions", () => {
    expect(getModel("kyc_case_test")).toBeDefined();
    expect(listModels().some((m) => m.name === "kyc_case_test")).toBe(true);

    expect(() =>
      defineModel({
        ...kycModel,
        name: "bad_model",
        listColumns: ["nonexistent_field"],
      }),
    ).toThrow(ModelError);
  });

  it("lists records with RBAC, field-level visibility, filtering, search, and sorting", async () => {
    await expect(
      listModelRecords(basePrisma, null, kycModel),
    ).rejects.toThrow(AuthorizationError);

    // Admin sees restricted customerEmail column; analyst does not.
    const adminList = await listModelRecords(basePrisma, admin, kycModel, {
      sortBy: "riskScore",
      sortDir: "desc",
    });
    expect(adminList.total).toBe(2);
    expect(adminList.items[0]?.caseNumber).toBe("KYC-M-001");
    expect(adminList.items[0]?.customerEmail).toBe("secret@apex.test");
    expect(adminList.columns.some((c) => c.key === "customerEmail")).toBe(true);

    const analystList = await listModelRecords(basePrisma, analyst, kycModel, {
      filters: { country: "US" },
    });
    expect(analystList.total).toBe(1);
    expect(analystList.items[0]?.caseNumber).toBe("KYC-M-002");
    expect(analystList.items[0]?.customerEmail).toBeUndefined();
    expect(analystList.columns.some((c) => c.key === "customerEmail")).toBe(false);

    // Analyst cannot filter on a role-restricted or unfilterable field.
    await expect(
      listModelRecords(basePrisma, analyst, kycModel, {
        filters: { customerEmail: "secret@apex.test" },
      }),
    ).rejects.toThrow(ModelError);

    await expect(
      listModelRecords(basePrisma, admin, kycModel, {
        filters: { riskScore: 82 },
      }),
    ).rejects.toThrow(ModelError);

    // Search works across visible searchable fields.
    const searched = await listModelRecords(basePrisma, analyst, kycModel, {
      search: "Apex",
    });
    expect(searched.total).toBe(1);
    expect(searched.items[0]?.caseNumber).toBe("KYC-M-001");
  });

  it("enforces permissions, editableFields allow-list, and auto-audit on update/delete", async () => {
    // Auditor is read-only: can read detail + audit trail, cannot update.
    const detail = await getModelRecord(
      basePrisma,
      auditor,
      kycModel,
      seededCaseId,
      { includeAuditTrail: true },
    );
    expect(detail.record.caseNumber).toBe("KYC-M-001");
    expect(detail.record.customerEmail).toBeUndefined();
    expect(Array.isArray(detail.auditTrail)).toBe(true);

    await expect(
      updateModelRecord(auditedPrisma, auditor, kycModel, seededCaseId, {
        summary: "Auditor cannot edit",
      }),
    ).rejects.toThrow(AuthorizationError);

    // Mass-assignment of non-editable field is rejected with 400.
    await expect(
      updateModelRecord(auditedPrisma, analyst, kycModel, seededCaseId, {
        riskScore: 1,
      }),
    ).rejects.toThrow(ModelError);

    // Valid update writes an automatic AuditLog entry.
    const updated = await updateModelRecord(
      auditedPrisma,
      analyst,
      kycModel,
      seededCaseId,
      { summary: "Requested additional corporate filing" },
      "Follow-up requested",
    );
    expect(updated.summary).toBe("Requested additional corporate filing");

    const trail = await getEntityAuditTrail(basePrisma, "KycCase", seededCaseId);
    expect(trail).toHaveLength(1);
    expect(trail[0]?.actorId).toBe(analyst.id);
    expect(trail[0]?.reason).toBe("Follow-up requested");

    // Analyst cannot delete; compliance_admin can delete and it is audited.
    await expect(
      deleteModelRecord(auditedPrisma, analyst, kycModel, seededCaseId),
    ).rejects.toThrow(AuthorizationError);

    await deleteModelRecord(
      auditedPrisma,
      admin,
      kycModel,
      seededCaseId,
      "Removed test case",
    );

    const trailAfterDelete = await getEntityAuditTrail(
      basePrisma,
      "KycCase",
      seededCaseId,
    );
    expect(trailAfterDelete.some((e) => e.action === "delete")).toBe(true);
  });
});
