import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BackofficeForbidden } from "@/features/backoffice/components/backoffice-forbidden";
import { BackofficeShell } from "@/features/backoffice/components/backoffice-shell";
import { guardBackofficePage } from "@/lib/backoffice/guard";

export default function BackofficeConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Console>{children}</Console>
    </Suspense>
  );
}

async function Console({ children }: { children: React.ReactNode }) {
  const r = await guardBackofficePage();
  if (!r.ok) {
    return (
      <div className="p-6">
        <BackofficeForbidden />
      </div>
    );
  }
  const { user, role } = r.ctx;
  return (
    <BackofficeShell
      viewer={{
        user: { id: user.id, name: user.name, email: user.email },
        role,
      }}
    >
      {children}
    </BackofficeShell>
  );
}

function ConsoleSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="h-16 bg-topbar" />
      <div className="flex">
        <div className="hidden h-[calc(100dvh-4rem)] w-60 bg-topbar lg:block" />
        <div className="grid flex-1 gap-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
