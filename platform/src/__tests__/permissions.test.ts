import { describe, expect, it } from "vitest";
import {
  assertCan,
  AuthorizationError,
  can,
  HIGH_RISK_THRESHOLD,
  type SessionUser,
} from "../index";

const analyst: SessionUser = {
  id: "u-analyst",
  email: "analyst@fintech.test",
  name: "Alex Analyst",
  role: "analyst",
};

const senior: SessionUser = {
  id: "u-senior",
  email: "senior@fintech.test",
  name: "Sam Senior",
  role: "senior_reviewer",
};

const admin: SessionUser = {
  id: "u-admin",
  email: "admin@fintech.test",
  name: "Ada Admin",
  role: "compliance_admin",
};

const auditor: SessionUser = {
  id: "u-auditor",
  email: "auditor@fintech.test",
  name: "Avery Auditor",
  role: "auditor",
};

describe("platform RBAC can(user, action, resource)", () => {
  it("denies unauthenticated callers for all actions", () => {
    expect(can(null, "read", "kyc_case")).toBe(false);
    expect(can(undefined, "view_audit", "audit_log")).toBe(false);
  });

  it("keeps auditor strictly read-only across all resources", () => {
    expect(can(auditor, "read", "kyc_case")).toBe(true);
    expect(can(auditor, "view_audit", "audit_log")).toBe(true);
    expect(can(auditor, "read", "kyc_document")).toBe(true);
    expect(can(auditor, "read", "sanctions_match")).toBe(true);

    for (const action of [
      "create",
      "update",
      "delete",
      "assign",
      "approve",
      "approve_high_risk",
      "reject",
      "escalate",
      "manage_users",
    ] as const) {
      expect(can(auditor, action, "kyc_case")).toBe(false);
    }
  });

  it("enforces analyst vs senior_reviewer vs compliance_admin boundaries", () => {
    // Low-risk approval allowed for analyst.
    expect(
      can(analyst, "approve", { type: "kyc_case", riskScore: HIGH_RISK_THRESHOLD - 1 }),
    ).toBe(true);

    // High-risk first-step sign-off allowed for analyst, but second-step final sign-off requires senior_reviewer+.
    expect(
      can(analyst, "approve", { type: "kyc_case", riskScore: HIGH_RISK_THRESHOLD }),
    ).toBe(true);
    expect(
      can(analyst, "approve", {
        type: "kyc_case",
        riskScore: HIGH_RISK_THRESHOLD,
        firstApproverId: "other-user",
      }),
    ).toBe(false);
    expect(can(analyst, "approve_high_risk", "kyc_case")).toBe(false);

    // Senior reviewer can give second sign-off on high-risk cases initiated by someone else.
    expect(
      can(senior, "approve", {
        type: "kyc_case",
        riskScore: HIGH_RISK_THRESHOLD,
        firstApproverId: analyst.id,
      }),
    ).toBe(true);
    expect(can(senior, "approve_high_risk", "kyc_case")).toBe(true);

    // Only compliance_admin can reassign to another user, delete cases, or manage users.
    expect(
      can(analyst, "assign", { type: "kyc_case", targetAssigneeId: analyst.id }),
    ).toBe(true);
    expect(
      can(analyst, "assign", { type: "kyc_case", targetAssigneeId: senior.id }),
    ).toBe(false);
    expect(
      can(senior, "assign", { type: "kyc_case", targetAssigneeId: analyst.id }),
    ).toBe(false);
    expect(
      can(admin, "assign", { type: "kyc_case", targetAssigneeId: analyst.id }),
    ).toBe(true);
    expect(
      can(analyst, "assign", {
        type: "kyc_case",
        assigneeId: senior.id,
        targetAssigneeId: null,
      }),
    ).toBe(false);
    expect(
      can(analyst, "assign", {
        type: "kyc_case",
        assigneeId: analyst.id,
        targetAssigneeId: null,
      }),
    ).toBe(true);

    expect(can(analyst, "delete", "kyc_case")).toBe(false);
    expect(can(senior, "delete", "kyc_case")).toBe(false);
    expect(can(admin, "delete", "kyc_case")).toBe(true);
    expect(can(senior, "manage_users", "user")).toBe(false);
    expect(can(admin, "manage_users", "user")).toBe(true);
  });

  it("enforces two-person separation of duties for every role including admin", () => {
    for (const user of [analyst, senior, admin]) {
      expect(
        can(user, "approve", {
          type: "kyc_case",
          riskScore: 85,
          firstApproverId: user.id,
        }),
      ).toBe(false);
      expect(
        can(user, "approve_high_risk", {
          type: "approval_request",
          firstApproverId: user.id,
        }),
      ).toBe(false);
    }
  });

  it("keeps audit_log strictly append-only for every role including compliance_admin", () => {
    for (const user of [analyst, senior, admin, auditor]) {
      expect(can(user, "update", "audit_log")).toBe(false);
      expect(can(user, "delete", "audit_log")).toBe(false);
    }
  });

  it("throws AuthorizationError(403) from assertCan when denied", () => {
    expect(() => assertCan(auditor, "approve", "kyc_case")).toThrow(
      AuthorizationError,
    );
    try {
      assertCan(auditor, "approve", "kyc_case");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      expect((err as AuthorizationError).statusCode).toBe(403);
    }
  });
});
