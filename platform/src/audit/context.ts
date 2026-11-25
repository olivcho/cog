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

// Shared via globalThis: Next.js compiles each route into its own bundle, and the
// cached audited Prisma client must read the same storage every route writes to.
const globalForAudit = globalThis as unknown as {
  __platformAuditStorage?: AsyncLocalStorage<AuditContext>;
};
const auditStorage = (globalForAudit.__platformAuditStorage ??=
  new AsyncLocalStorage<AuditContext>());

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
