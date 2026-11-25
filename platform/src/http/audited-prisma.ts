import { createAuditedPrismaClient, type AuditedPrismaClient } from "../audit";
import { getPrisma } from "../db/client";

const globalForAudited = globalThis as unknown as {
  __auditedPrisma?: AuditedPrismaClient;
};

export function getAuditedPrisma(): AuditedPrismaClient {
  if (!globalForAudited.__auditedPrisma) {
    globalForAudited.__auditedPrisma = createAuditedPrismaClient(getPrisma());
  }
  return globalForAudited.__auditedPrisma;
}
