import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SuppliersView } from "@/features/suppliers/components/suppliers-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER_MANAGER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.suppliers");
  return { title: t("title") };
}

export default async function SuppliersPage() {
  const t = await getTranslations("pages.suppliers");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<SuppliersSkeleton />}>
        <SuppliersContent />
      </Suspense>
    </>
  );
}

async function SuppliersContent() {
  const guard = await guardPage({ roles: OWNER_MANAGER });
  if (guard.ok) return <SuppliersView orgId={guard.ctx.organizationId} />;
  return <ForbiddenState />;
}

function SuppliersSkeleton() {
  return (
    <div className="grid max-w-3xl gap-4">
      <Skeleton className="ml-auto h-11 w-40 rounded-full" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}
