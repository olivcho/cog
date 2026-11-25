import type { Role } from "../types";
import { Tag } from "./primitives";

export function formatRole(role: Role): string {
  return role.replace(/_/g, " ");
}

export function RoleBadge({ role }: { role: Role }) {
  return <Tag tone="muted">{formatRole(role)}</Tag>;
}
