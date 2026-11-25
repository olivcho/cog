import type { Prisma, PrismaClient } from "@prisma/client";
import { getAuditContext, withAuditContext, type AuditContext } from "./context";

const REDACTED_FIELDS = new Set(["passwordHash", "tokenHash"]);
const SKIP_AUDIT_MODELS = new Set(["AuditLog", "Session"]);
const BLOCKED_AUDIT_LOG_OPS = new Set([
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);
const SINGLE_WRITE_OPS = new Set(["create", "update", "upsert", "delete"]);
const BULK_WRITE_OPS = new Set(["createMany", "updateMany", "deleteMany"]);

export class AuditImmutabilityError extends Error {
  readonly statusCode = 403;

  constructor(operation: string) {
    super(`AuditLog is append-only: operation "${operation}" is forbidden`);
    this.name = "AuditImmutabilityError";
  }
}

export function redactForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_FIELDS.has(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactForAudit(v);
      }
    }
    return out;
  }
  return value;
}

function toJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(redactForAudit(value));
}

function extractEntityId(record: unknown): string {
  if (
    typeof record === "object" &&
    record !== null &&
    "id" in record &&
    typeof (record as { id?: unknown }).id === "string"
  ) {
    return (record as { id: string }).id;
  }
  return "unknown";
}

function toDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

async function fetchBeforeSnapshot(
  client: PrismaClient | Prisma.TransactionClient,
  model: string,
  args: unknown,
): Promise<unknown> {
  if (typeof args !== "object" || args === null || !("where" in args)) {
    return null;
  }
  const where = (args as { where?: unknown }).where;
  if (!where) return null;

  const delegateName = toDelegateName(model);
  const delegate = (client as unknown as Record<string, unknown>)[
    delegateName
  ] as
    | { findUnique?: (q: { where: unknown }) => Promise<unknown> }
    | undefined;

  if (!delegate?.findUnique) return null;
  try {
    return await delegate.findUnique({ where });
  } catch {
    return null;
  }
}

function stripIncludedRelations(value: unknown, args: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !args ||
    typeof args !== "object" ||
    !("include" in args)
  ) {
    return value;
  }

  const include = (args as { include?: Record<string, unknown> }).include;
  if (!include || typeof include !== "object") return value;

  const includedKeys = new Set(
    Object.entries(include)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key),
  );
  if (includedKeys.size === 0) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!includedKeys.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

export function createAuditedPrismaClient(baseClient: PrismaClient) {
  return baseClient.$extends({
    name: "platform-auto-audit",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === "AuditLog" && BLOCKED_AUDIT_LOG_OPS.has(operation)) {
            throw new AuditImmutabilityError(operation);
          }

          if (!model || SKIP_AUDIT_MODELS.has(model)) {
            return query(args);
          }

          if (SINGLE_WRITE_OPS.has(operation)) {
            const ctx = getAuditContext();
            const auditWriter = ctx?.tx ?? baseClient;

            const before =
              operation === "update" ||
              operation === "delete" ||
              operation === "upsert"
                ? await fetchBeforeSnapshot(auditWriter, model, args)
                : null;

            const result = await query(args);
            const after =
              operation === "delete"
                ? null
                : stripIncludedRelations(result, args);
            const entityId = extractEntityId(after ?? before);
            const resolvedOp =
              operation === "upsert"
                ? before
                  ? "update"
                  : "create"
                : operation;

            await auditWriter.auditLog.create({
              data: {
                actorId: ctx?.actor?.id ?? null,
                actorEmail: ctx?.actor?.email ?? ctx?.actorEmail ?? "system",
                action: ctx?.actionOverride ?? resolvedOp,
                entityType: model,
                entityId,
                beforeJson: toJsonString(before),
                afterJson: toJsonString(after),
                reason: ctx?.reason ?? null,
              },
            });

            return result;
          }

          if (BULK_WRITE_OPS.has(operation)) {
            const ctx = getAuditContext();
            const auditWriter = ctx?.tx ?? baseClient;
            const result = await query(args);

            await auditWriter.auditLog.create({
              data: {
                actorId: ctx?.actor?.id ?? null,
                actorEmail: ctx?.actor?.email ?? ctx?.actorEmail ?? "system",
                action: ctx?.actionOverride ?? operation,
                entityType: model,
                entityId: "bulk",
                beforeJson: toJsonString(
                  typeof args === "object" && args !== null && "where" in args
                    ? (args as { where?: unknown }).where
                    : null,
                ),
                afterJson: toJsonString(result),
                reason: ctx?.reason ?? null,
              },
            });

            return result;
          }

          return query(args);
        },
      },
    },
  });
}

export type AuditedPrismaClient = ReturnType<typeof createAuditedPrismaClient>;

export async function runAuditedTransaction<T>(
  auditedClient: AuditedPrismaClient,
  context: Omit<AuditContext, "tx">,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return auditedClient.$transaction(async (tx) => {
    const txClient = tx as unknown as Prisma.TransactionClient;
    return withAuditContext({ ...context, tx: txClient }, () => fn(txClient));
  });
}

export async function recordAuditEvent(
  client: PrismaClient | Prisma.TransactionClient,
  input: {
    actorId?: string | null;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  },
) {
  return client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: toJsonString(input.before ?? null),
      afterJson: toJsonString(input.after ?? null),
      reason: input.reason ?? null,
    },
  });
}

export async function getEntityAuditTrail(
  client: PrismaClient,
  entityType: string,
  entityId: string,
) {
  return client.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}
