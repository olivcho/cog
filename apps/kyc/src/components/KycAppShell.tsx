"use client";

import { useRouter } from "next/navigation";
import type { Role, SessionUser } from "@internal/platform/types";
import { KycWorkspace } from "./KycWorkspace";
import { LoginView } from "./LoginView";

interface DemoPersona {
  email: string;
  name: string;
  role: Role;
  password: string;
  description: string;
}

export function KycAppShell({
  initialUser,
  demoAccounts,
}: {
  initialUser: SessionUser | null;
  demoAccounts: readonly DemoPersona[];
}) {
  const router = useRouter();

  if (!initialUser) {
    return (
      <LoginView
        demoAccounts={demoAccounts}
        onSuccess={() => router.refresh()}
      />
    );
  }

  return (
    <KycWorkspace
      initialUser={initialUser}
      onSignedOut={() => router.refresh()}
    />
  );
}
