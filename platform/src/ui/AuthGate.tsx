"use client";

import { useMemo, type ReactNode } from "react";
import type { DemoAccountInfo } from "../db/seed";
import type { SessionUser } from "../types";
import { LoginView } from "./LoginView";
import { SessionContext } from "./session-context";

export interface AuthGateProps {
  appName: string;
  initialUser: SessionUser | null;
  /** Called after sign-in or sign-out so the host can re-fetch the session (e.g. Next's router.refresh). */
  onAuthChange: () => void;
  loginDescription?: ReactNode;
  demoAccounts?: readonly DemoAccountInfo[];
  loginEndpoint?: string;
  logoutEndpoint?: string;
  children: ReactNode;
}

export function AuthGate({
  appName,
  initialUser,
  onAuthChange,
  loginDescription,
  demoAccounts,
  loginEndpoint = "/api/auth/login",
  logoutEndpoint = "/api/auth/logout",
  children,
}: AuthGateProps) {
  const value = useMemo(
    () =>
      initialUser
        ? {
            user: initialUser,
            signOut: async () => {
              await fetch(logoutEndpoint, { method: "POST" });
              onAuthChange();
            },
          }
        : null,
    [initialUser, logoutEndpoint, onAuthChange],
  );

  if (!value) {
    return (
      <LoginView
        appName={appName}
        description={loginDescription}
        demoAccounts={demoAccounts}
        loginEndpoint={loginEndpoint}
        onSuccess={onAuthChange}
      />
    );
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
