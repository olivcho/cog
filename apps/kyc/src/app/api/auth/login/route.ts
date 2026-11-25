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

const accountLimiter = new LoginRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
});

const ipLimiter = new LoginRateLimiter({
  maxAttempts: 30,
  windowMs: 15 * 60 * 1000,
});

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

  if (!email.trim() || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const accountKey = email.trim().toLowerCase();
  const ipKey = getClientIp(request);
  const accountCheck = accountLimiter.check(accountKey);
  const ipCheck = ipLimiter.check(ipKey);
  if (!accountCheck.allowed || !ipCheck.allowed) {
    const retryAfter = Math.max(
      accountCheck.retryAfterSeconds,
      ipCheck.retryAfterSeconds,
    );
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const user = await authenticateCredentials(prisma, email, password);
  if (!user) {
    accountLimiter.recordFailure(accountKey);
    ipLimiter.recordFailure(ipKey);
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  accountLimiter.reset(accountKey);
  const session = await createSession(prisma, user.id);
  const response = NextResponse.json({ user }, { status: 200 });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.cookieValue,
    buildSessionCookieOptions(session.expiresAt),
  );
  return response;
}
