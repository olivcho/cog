import { cookies } from "next/headers";
import {
  getSessionUser,
  prisma,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@internal/platform";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(prisma, cookieValue);
}
