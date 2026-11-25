import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { loadWorkspaceEnv } from "../db/env";
import { ROLES, type Role, type SessionUser } from "../types";
import { consumeDummyPasswordWork, verifyPassword } from "./password";

export const SESSION_COOKIE_NAME = "internal_platform_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DEV_FALLBACK_SECRET = "dev-session-secret-change-in-production";

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function getSessionSecret(): string {
  loadWorkspaceEnv();
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set (at least 16 characters) in production",
    );
  }
  return secret || DEV_FALLBACK_SECRET;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function signToken(rawToken: string, secret: string): string {
  return createHmac("sha256", secret).update(rawToken).digest("base64url");
}

export function encodeSessionCookie(
  rawToken: string,
  secret: string = getSessionSecret(),
): string {
  const sig = signToken(rawToken, secret);
  return `${rawToken}.${sig}`;
}

export function verifySessionCookie(
  cookieValue: string | undefined | null,
  secret: string = getSessionSecret(),
): string | null {
  if (!cookieValue) return null;
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex <= 0 || dotIndex !== cookieValue.lastIndexOf(".")) {
    return null;
  }
  const rawToken = cookieValue.slice(0, dotIndex);
  const providedSig = cookieValue.slice(dotIndex + 1);
  if (!rawToken || !providedSig) return null;

  const expectedSig = signToken(rawToken, secret);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }
  return rawToken;
}

export interface CreatedSession {
  sessionId: string;
  cookieValue: string;
  expiresAt: Date;
}

export async function createSession(
  db: PrismaClient,
  userId: string,
  ttlMs: number = SESSION_TTL_MS,
): Promise<CreatedSession> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);

  const session = await db.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    sessionId: session.id,
    cookieValue: encodeSessionCookie(rawToken),
    expiresAt,
  };
}

export async function authenticateCredentials(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    await consumeDummyPasswordWork(password);
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    await consumeDummyPasswordWork(password);
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || !isRole(user.role)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function getSessionUser(
  db: PrismaClient,
  cookieValue: string | undefined | null,
): Promise<SessionUser | null> {
  const rawToken = verifySessionCookie(cookieValue);
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (!isRole(session.user.role)) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function revokeSession(
  db: PrismaClient,
  cookieValue: string | undefined | null,
): Promise<void> {
  const rawToken = verifySessionCookie(cookieValue);
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.session.deleteMany({ where: { tokenHash } });
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  };
}
