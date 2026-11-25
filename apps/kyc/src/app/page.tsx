import { DEMO_ACCOUNTS } from "@internal/platform";
import { KycAppShell } from "@/components/KycAppShell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <KycAppShell initialUser={user} demoAccounts={DEMO_ACCOUNTS} />;
}
