import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StockView } from "@/features/stock/components/stock-view";
import { requirePageMember } from "@/lib/page-guard";

export async function generateMetadata() {
  const t = await getTranslations("pages.stock");
  return { title: t("title") };
}

export default async function StockPage() {
  const t = await getTranslations("pages.stock");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<StockSkeleton />}>
        <StockContent />
      </Suspense>
    </>
  );
}

async function StockContent() {
  const ctx = await requirePageMember();
  return <StockView orgId={ctx.organizationId} role={ctx.role} />;
}

function StockSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-full max-w-xs rounded-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
