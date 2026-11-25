import { NextResponse } from "next/server";
import {
  authenticateCredentials,
  buildSessionCookieOptions,
  createSession,
  LoginRateLimiter,
  prisma,
  SESSION_COOKIE_NAME,
} from "@internal/platform";
import { validateSameOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

const credentialLimiter = new LoginRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
});

const ipLimiter = new LoginRateLimiter({
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
});

const MAX_EMAIL_LENGTH = 320;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  const csrfError = validateSameOrigin(request, { requireJson: true });
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const email =
    typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
      ? body.email
      : "";
  const password =
    typeof body === "object" && body !== null && "password" in body && typeof body.password === "string"
      ? body.password
      : "";

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 },
    );
  }

  const ipKey = getClientIp(request);
  const credentialKey = `${ipKey}:${normalizedEmail}`;
  const ipCheck = ipLimiter.consume(ipKey);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipCheck.retryAfterSeconds) },
      },
    );
  }

  const credentialCheck = credentialLimiter.consume(credentialKey);
  if (!credentialCheck.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(credentialCheck.retryAfterSeconds) },
      },
    );
  }

  const user = await authenticateCredentials(prisma, normalizedEmail, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  credentialLimiter.reset(credentialKey);
  const session = await createSession(prisma, user.id);
  const response = NextResponse.json({ user }, { status: 200 });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.cookieValue,
    buildSessionCookieOptions(session.expiresAt),
  );
  return response;
}
