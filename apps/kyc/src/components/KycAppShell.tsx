"use client";

import { useRouter } from "next/navigation";
import type { DemoAccountInfo } from "@internal/platform";
import type { SessionUser } from "@internal/platform/types";
import { AuthGate } from "@internal/platform/ui";
import { KycWorkspace } from "./KycWorkspace";

export function KycAppShell({
  initialUser,
  demoAccounts,
}: {
  initialUser: SessionUser | null;
  demoAccounts: readonly DemoAccountInfo[];
}) {
  const router = useRouter();

  return (
    <AuthGate
      appName="KYC Review Queue"
      initialUser={initialUser}
      demoAccounts={demoAccounts}
      onAuthChange={router.refresh}
      loginDescription="Sign in with email & password or choose a seeded fintech persona to inspect role-based permissions, two-person approvals, and the append-only audit trail."
    >
      <KycWorkspace />
    </AuthGate>
  );
}
