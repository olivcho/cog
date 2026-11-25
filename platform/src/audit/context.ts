import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "../types";

export interface AuditContext {
  actor?: SessionUser | null;
  actorEmail?: string;
  reason?: string;
  actionOverride?: string;
  /** Internal: active transaction client so audit writes stay atomic on SQLite/Postgres. */
  tx?: Prisma.TransactionClient;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

/**
 * Runs `fn` with an active audit context. Awaits the result inside `run()`
 * so lazy PrismaPromise queries always execute while AsyncLocalStorage is bound.
 */
export async function withAuditContext<T>(
  context: AuditContext,
  fn: () => Promise<T> | T,
): Promise<T> {
  const parent = auditStorage.getStore();
  return auditStorage.run({ ...parent, ...context }, async () => await fn());
}

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}
