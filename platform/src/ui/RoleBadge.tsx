import type { Role } from "../types";

const ROLE_STYLES: Record<Role, string> = {
  analyst: "bg-blue-50 text-blue-700 border-blue-200",
  senior_reviewer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  compliance_admin: "bg-purple-50 text-purple-700 border-purple-200",
  auditor: "bg-slate-100 text-slate-700 border-slate-300",
};

export function formatRole(role: Role): string {
  return role.replace(/_/g, " ");
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[role]}`}
    >
      {formatRole(role)}
    </span>
  );
}
