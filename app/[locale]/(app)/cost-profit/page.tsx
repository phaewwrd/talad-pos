import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForbiddenState, UpgradeState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CostProfitView } from "@/features/cost-profit/components/cost-profit-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.costProfit");
  return { title: t("title") };
}

export default async function CostProfitPage() {
  const t = await getTranslations("pages.costProfit");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<CostProfitSkeleton />}>
        <CostProfitContent />
      </Suspense>
    </>
  );
}

async function CostProfitContent() {
  const guard = await guardPage({ roles: OWNER, feature: "costProfit" });
  if (guard.ok) return <CostProfitView orgId={guard.ctx.organizationId} />;
  return guard.reason === "upgrade" ? <UpgradeState /> : <ForbiddenState />;
}

function CostProfitSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
