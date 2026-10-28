import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { getShellSession } from "@/features/auth/shell-session";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await getShellSession();
  return <AppShell session={session}>{children}</AppShell>;
}
