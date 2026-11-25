import { NextResponse } from "next/server";
import {
  authenticateCredentials,
  buildSessionCookieOptions,
  createSession,
  prisma,
  SESSION_COOKIE_NAME,
} from "@internal/platform";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const user = await authenticateCredentials(prisma, email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const session = await createSession(prisma, user.id);
  const response = NextResponse.json({ user }, { status: 200 });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.cookieValue,
    buildSessionCookieOptions(session.expiresAt),
  );
  return response;
}
