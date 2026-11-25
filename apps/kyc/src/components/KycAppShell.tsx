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
      appName="KYC review"
      initialUser={initialUser}
      demoAccounts={demoAccounts}
      onAuthChange={router.refresh}
      loginDescription="Sign in to review KYC cases."
    >
      <KycWorkspace />
    </AuthGate>
  );
}
