import { ApprovalError } from "../approvals";
import { AuditImmutabilityError } from "../audit";
import { ModelError } from "../models/registry";
import { AuthorizationError } from "../permissions";

export function handleApiError(err: unknown): Response {
  if (
    err instanceof AuthorizationError ||
    err instanceof ApprovalError ||
    err instanceof ModelError ||
    err instanceof AuditImmutabilityError
  ) {
    return Response.json({ error: err.message }, { status: err.statusCode });
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
