import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(currentDir, "../../prisma/dev.db");

export function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) {
    return `file:${defaultDbPath}`;
  }
  if (configured.startsWith("file:./") || configured.startsWith("file:../")) {
    const relativePath = configured.slice("file:".length);
    const resolved = path.resolve(currentDir, "../../prisma", relativePath);
    return `file:${resolved}`;
  }
  return configured;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl ?? resolveDatabaseUrl(),
      },
    },
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
