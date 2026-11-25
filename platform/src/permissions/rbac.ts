import { HIGH_RISK_THRESHOLD, type Role, type SessionUser } from "../types";

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "assign",
  "approve",
  "approve_high_risk",
  "reject",
  "escalate",
  "view_audit",
  "manage_users",
] as const;

export type Action = (typeof ACTIONS)[number];

export const RESOURCE_TYPES = [
  "kyc_case",
  "kyc_document",
  "sanctions_match",
  "approval_request",
  "audit_log",
  "user",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface ResourceDescriptor {
  type: ResourceType;
  id?: string;
  riskScore?: number;
  assigneeId?: string | null;
  targetAssigneeId?: string | null;
  firstApproverId?: string | null;
}

export type Resource = ResourceType | ResourceDescriptor;

export class AuthorizationError extends Error {
  readonly statusCode = 403;
  readonly action: Action;
  readonly resourceType: ResourceType;

  constructor(action: Action, resourceType: ResourceType, message?: string) {
    super(
      message ??
        `Forbidden: missing permission to ${action} on ${resourceType}`,
    );
    this.name = "AuthorizationError";
    this.action = action;
    this.resourceType = resourceType;
  }
}

type PermissionMatrix = Record<Role, Record<ResourceType, readonly Action[]>>;

const PERMISSION_MATRIX: PermissionMatrix = {
  auditor: {
    kyc_case: ["read", "view_audit"],
    kyc_document: ["read"],
    sanctions_match: ["read"],
    approval_request: ["read"],
    audit_log: ["read", "view_audit"],
    user: ["read"],
  },
  analyst: {
    kyc_case: [
      "read",
      "create",
      "update",
      "assign",
      "approve",
      "reject",
      "escalate",
      "view_audit",
    ],
    kyc_document: ["read", "create", "update"],
    sanctions_match: ["read", "update"],
    approval_request: ["read", "create", "approve", "reject", "escalate"],
    audit_log: ["read", "view_audit"],
    user: ["read"],
  },
  senior_reviewer: {
    kyc_case: [
      "read",
      "create",
      "update",
      "assign",
      "approve",
      "approve_high_risk",
      "reject",
      "escalate",
      "view_audit",
    ],
    kyc_document: ["read", "create", "update"],
    sanctions_match: ["read", "update"],
    approval_request: [
      "read",
      "create",
      "approve",
      "approve_high_risk",
      "reject",
      "escalate",
    ],
    audit_log: ["read", "view_audit"],
    user: ["read"],
  },
  compliance_admin: {
    kyc_case: [
      "read",
      "create",
      "update",
      "delete",
      "assign",
      "approve",
      "approve_high_risk",
      "reject",
      "escalate",
      "view_audit",
    ],
    kyc_document: ["read", "create", "update", "delete"],
    sanctions_match: ["read", "create", "update"],
    approval_request: [
      "read",
      "create",
      "approve",
      "approve_high_risk",
      "reject",
      "escalate",
    ],
    audit_log: ["read", "view_audit"],
    user: ["read", "create", "update", "manage_users"],
  },
};

function normalizeResource(resource: Resource): ResourceDescriptor {
  return typeof resource === "string" ? { type: resource } : resource;
}

/**
 * Single authorization entrypoint for the entire platform.
 * Enforces role capabilities plus cross-cutting fintech invariants:
 *  - audit_log is strictly append-only (never updatable or deletable)
 *  - two-person separation of duties (a user cannot second-approve their own first sign-off)
 *  - only compliance_admin can reassign cases to another user
 *  - high-risk final approval (riskScore >= HIGH_RISK_THRESHOLD) requires senior_reviewer or compliance_admin
 */
export function can(
  user: SessionUser | null | undefined,
  action: Action,
  resource: Resource,
): boolean {
  if (!user) return false;

  const desc = normalizeResource(resource);

  // Invariant 1: Audit logs are append-only for every role, including compliance_admin.
  if (
    desc.type === "audit_log" &&
    (action === "update" || action === "delete")
  ) {
    return false;
  }

  // Invariant 2: Two-person sign-off — cannot approve a second step if you did the first step.
  if (
    (action === "approve" || action === "approve_high_risk") &&
    desc.firstApproverId &&
    desc.firstApproverId === user.id
  ) {
    return false;
  }

  // Invariant 3: High-risk final approval requires approve_high_risk capability.
  const effectiveAction: Action =
    action === "approve" &&
    desc.riskScore !== undefined &&
    desc.riskScore >= HIGH_RISK_THRESHOLD &&
    desc.firstApproverId !== undefined &&
    desc.firstApproverId !== null
      ? "approve_high_risk"
      : action;

  const allowed = PERMISSION_MATRIX[user.role]?.[desc.type];
  if (!allowed || !allowed.includes(effectiveAction)) {
    return false;
  }

  // Invariant 4: Only compliance_admin may assign/reassign a case to a different user
  // or unassign a case currently owned by someone else.
  if (action === "assign" && user.role !== "compliance_admin") {
    const reassigningToOther =
      desc.targetAssigneeId !== undefined &&
      desc.targetAssigneeId !== null &&
      desc.targetAssigneeId !== user.id;
    const unassigningOther =
      desc.targetAssigneeId === null &&
      desc.assigneeId !== undefined &&
      desc.assigneeId !== null &&
      desc.assigneeId !== user.id;
    if (reassigningToOther || unassigningOther) {
      return false;
    }
  }

  return true;
}

export function assertCan(
  user: SessionUser | null | undefined,
  action: Action,
  resource: Resource,
): asserts user is SessionUser {
  const desc = normalizeResource(resource);
  if (!can(user, action, desc)) {
    throw new AuthorizationError(action, desc.type);
  }
}
