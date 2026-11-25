import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  prisma,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "@internal/platform";
import { validateSameOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfError = validateSameOrigin(request);
  if (csrfError) return csrfError;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await revokeSession(prisma, cookieValue);

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
