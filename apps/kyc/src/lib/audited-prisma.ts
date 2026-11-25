import {
  createAuditedPrismaClient,
  type AuditedPrismaClient,
} from "@internal/platform/audit";
import { getPrisma } from "@internal/platform/db";

const globalForAudited = globalThis as unknown as {
  __auditedPrisma?: AuditedPrismaClient;
};

export function getAuditedPrisma(): AuditedPrismaClient {
  if (!globalForAudited.__auditedPrisma) {
    globalForAudited.__auditedPrisma = createAuditedPrismaClient(getPrisma());
  }
  return globalForAudited.__auditedPrisma;
}
