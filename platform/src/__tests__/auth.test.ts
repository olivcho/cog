import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authenticateCredentials,
  createPrismaClient,
  createSession,
  encodeSessionCookie,
  getSessionUser,
  hashPassword,
  revokeSession,
  verifyPassword,
  verifySessionCookie,
} from "../index";

describe("platform identity & sessions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-auth-"));
  const dbFile = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbFile}`;
  const prisma = createPrismaClient(databaseUrl);

  beforeAll(() => {
    const platformDir = path.resolve(__dirname, "../..");
    execFileSync(
      "npx",
      ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
      {
        cwd: platformDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("hashes and verifies passwords with scrypt", async () => {
    const hash1 = await hashPassword("correct-horse-battery-staple");
    const hash2 = await hashPassword("correct-horse-battery-staple");

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("correct-horse-battery-staple", hash1)).toBe(
      true,
    );
    expect(await verifyPassword("wrong-password", hash1)).toBe(false);
    expect(await verifyPassword("anything", "malformed-hash")).toBe(false);
    await expect(hashPassword("")).rejects.toThrow();
  });

  it("signs and verifies session cookies and rejects tampering", () => {
    const secret = "test-secret-at-least-16-chars";
    const cookie = encodeSessionCookie("raw-token-123", secret);

    expect(verifySessionCookie(cookie, secret)).toBe("raw-token-123");
    expect(verifySessionCookie(`${cookie}x`, secret)).toBeNull();
    expect(verifySessionCookie(`tampered.${cookie.split(".")[1]}`, secret)).toBeNull();
    expect(verifySessionCookie(cookie, "different-secret-16-chars")).toBeNull();
    expect(verifySessionCookie("no-dot-token", secret)).toBeNull();
    expect(verifySessionCookie(undefined, secret)).toBeNull();
  });

  it("authenticates users, issues DB sessions, expires old sessions, and revokes on logout", async () => {
    const passwordHash = await hashPassword("hunter2-fintech");
    const user = await prisma.user.create({
      data: {
        email: "reviewer@fintech.test",
        name: "Riley Reviewer",
        passwordHash,
        role: "senior_reviewer",
      },
    });

    const authed = await authenticateCredentials(
      prisma,
      "  REVIEWER@fintech.test ",
      "hunter2-fintech",
    );
    expect(authed).toEqual({
      id: user.id,
      email: "reviewer@fintech.test",
      name: "Riley Reviewer",
      role: "senior_reviewer",
    });

    expect(
      await authenticateCredentials(prisma, "reviewer@fintech.test", "bad"),
    ).toBeNull();
    expect(
      await authenticateCredentials(prisma, "nobody@fintech.test", "hunter2-fintech"),
    ).toBeNull();

    const session = await createSession(prisma, user.id, 60_000);
    const resolved = await getSessionUser(prisma, session.cookieValue);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.role).toBe("senior_reviewer");

    await revokeSession(prisma, session.cookieValue);
    expect(await getSessionUser(prisma, session.cookieValue)).toBeNull();

    // Expired session is rejected and cleaned up.
    const expired = await createSession(prisma, user.id, -1_000);
    expect(await getSessionUser(prisma, expired.cookieValue)).toBeNull();
    const remaining = await prisma.session.findUnique({
      where: { id: expired.sessionId },
    });
    expect(remaining).toBeNull();
  });
});
