import {
  authenticateCredentials,
  buildSessionCookieOptions,
  createSession,
  getSessionUser,
  LoginRateLimiter,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "../auth";
import { getPrisma } from "../db/client";
import { assertCan } from "../permissions";
import type { SessionUser } from "../types";
import { readCookie, serializeCookie } from "./cookies";
import { validateSameOrigin } from "./csrf";
import { handleApiError } from "./errors";

const MAX_EMAIL_LENGTH = 320;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null || !(key in body)) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function tooManyAttempts(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many login attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function getUserFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  const cookieValue = readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return getSessionUser(getPrisma(), cookieValue);
}

export function createLoginHandler(options?: {
  maxAttemptsPerCredential?: number;
  maxAttemptsPerIp?: number;
  windowMs?: number;
}) {
  const windowMs = options?.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const credentialLimiter = new LoginRateLimiter({
    maxAttempts: options?.maxAttemptsPerCredential ?? 10,
    windowMs,
  });
  const ipLimiter = new LoginRateLimiter({
    maxAttempts: options?.maxAttemptsPerIp ?? 30,
    windowMs,
  });

  return async function POST(request: Request): Promise<Response> {
    const csrfError = validateSameOrigin(request, { requireJson: true });
    if (csrfError) return csrfError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const normalizedEmail = readStringField(body, "email").trim().toLowerCase();
    const password = readStringField(body, "password");
    if (!normalizedEmail || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }
    if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
      return Response.json({ error: "Invalid email address" }, { status: 400 });
    }

    const ipKey = getClientIp(request);
    const credentialKey = `${ipKey}:${normalizedEmail}`;
    const ipCheck = ipLimiter.consume(ipKey);
    if (!ipCheck.allowed) return tooManyAttempts(ipCheck.retryAfterSeconds);
    const credentialCheck = credentialLimiter.consume(credentialKey);
    if (!credentialCheck.allowed) {
      return tooManyAttempts(credentialCheck.retryAfterSeconds);
    }

    const prisma = getPrisma();
    const user = await authenticateCredentials(prisma, normalizedEmail, password);
    if (!user) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    ipLimiter.release(ipKey);
    credentialLimiter.reset(credentialKey);
    const session = await createSession(prisma, user.id);
    return Response.json(
      { user },
      {
        status: 200,
        headers: {
          "Set-Cookie": serializeCookie(
            SESSION_COOKIE_NAME,
            session.cookieValue,
            buildSessionCookieOptions(session.expiresAt),
          ),
        },
      },
    );
  };
}

export async function logoutHandler(request: Request): Promise<Response> {
  const csrfError = validateSameOrigin(request);
  if (csrfError) return csrfError;

  const cookieValue = readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  await revokeSession(getPrisma(), cookieValue);

  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": serializeCookie(SESSION_COOKIE_NAME, "", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
          maxAge: 0,
        }),
      },
    },
  );
}

export async function meHandler(request: Request): Promise<Response> {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user }, { status: 200 });
}

export async function auditLogHandler(request: Request): Promise<Response> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ error: "Unauthenticated" }, { status: 401 });
    }
    assertCan(user, "read", "audit_log");

    const params = new URL(request.url).searchParams;
    const entityId = params.get("entityId")?.trim() || undefined;
    const entityType = params.get("entityType")?.trim() || undefined;
    const action = params.get("action")?.trim() || undefined;

    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (entityType) where.entityType = entityType;
    if (action && action !== "all") where.action = action;

    const entries = await getPrisma().auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ entries });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function healthHandler(): Promise<Response> {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check database connectivity error:", error);
    return Response.json(
      { status: "error", database: "disconnected" },
      { status: 500 },
    );
  }
}
