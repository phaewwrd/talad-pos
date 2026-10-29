import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForbiddenState, UpgradeState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PromotionsView } from "@/features/promotions/components/promotions-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER_MANAGER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.promotions");
  return { title: t("title") };
}

export default async function PromotionsPage() {
  const t = await getTranslations("pages.promotions");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<PromotionsSkeleton />}>
        <PromotionsContent />
      </Suspense>
    </>
  );
}

async function PromotionsContent() {
  const guard = await guardPage({
    roles: OWNER_MANAGER,
    feature: "promotions",
  });
  if (guard.ok) return <PromotionsView orgId={guard.ctx.organizationId} />;
  return guard.reason === "upgrade" ? <UpgradeState /> : <ForbiddenState />;
}

function PromotionsSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-11 w-full max-w-md rounded-full" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
