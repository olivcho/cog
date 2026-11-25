"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "../types";

export interface SessionContextValue {
  user: SessionUser;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <AuthGate>");
  }
  return ctx;
}
