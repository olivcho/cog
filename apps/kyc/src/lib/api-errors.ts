import { NextResponse } from "next/server";
import { ApprovalError } from "@internal/platform/approvals";
import { AuditImmutabilityError } from "@internal/platform/audit";
import { ModelError } from "@internal/platform/models";
import { AuthorizationError } from "@internal/platform/permissions";

export function handleApiError(err: unknown) {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof ApprovalError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof ModelError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  if (err instanceof AuditImmutabilityError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
