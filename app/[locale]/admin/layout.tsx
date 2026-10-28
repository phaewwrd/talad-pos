import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/common/access-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminChrome } from "@/features/admin/components/admin-chrome";
import { AppError } from "@/lib/errors";
import { requirePlatformAdmin } from "@/lib/permissions";

export default function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96 rounded-2xl" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (err instanceof AppError && err.code === "FORBIDDEN") {
      return (
        <div className="p-6">
          <ForbiddenState />
        </div>
      );
    }
    redirect(`/${await rootLocale()}/login?next=/admin/invites`);
  }
  return <AdminChrome>{children}</AdminChrome>;
}
