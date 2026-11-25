export const ROLES = [
  "analyst",
  "senior_reviewer",
  "compliance_admin",
  "auditor",
] as const;

export type Role = (typeof ROLES)[number];

export const KYC_CASE_STATUSES = [
  "open",
  "in_review",
  "pending_second_approval",
  "approved",
  "rejected",
  "escalated",
] as const;

export type KycCaseStatus = (typeof KYC_CASE_STATUSES)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "pending_second_approval",
  "approved",
  "rejected",
  "escalated",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_DECISIONS = ["approved", "rejected", "escalated"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const HIGH_RISK_THRESHOLD = 70;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
