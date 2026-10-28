import { ImpersonationBanner } from "@/features/backoffice/impersonation/components/impersonation-banner";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import type { ShellSession } from "./shell-types";
import { TopBar } from "./top-bar";

export function AppShell({
  session,
  children,
}: {
  session: ShellSession;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        {session.impersonating && (
          <ImpersonationBanner ownerName={session.user.name} />
        )}
        <TopBar session={session} />
        <main className="flex-1 px-4 pt-4 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>
      <MobileTabBar role={session.role} />
    </div>
  );
}
