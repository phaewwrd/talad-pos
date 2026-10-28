import { getTranslations } from "next-intl/server";
import { ForbiddenState, UpgradeState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { CostProfitView } from "@/features/cost-profit/components/cost-profit-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.costProfit");
  return { title: t("title") };
}

export default async function CostProfitPage() {
  const [t, guard] = await Promise.all([
    getTranslations("pages.costProfit"),
    guardPage({ roles: OWNER, feature: "costProfit" }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      {guard.ok ? (
        <CostProfitView orgId={guard.ctx.organizationId} />
      ) : guard.reason === "upgrade" ? (
        <UpgradeState />
      ) : (
        <ForbiddenState />
      )}
    </>
  );
}
