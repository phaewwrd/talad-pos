import { getTranslations } from "next-intl/server";
import { ForbiddenState, UpgradeState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { PromotionsView } from "@/features/promotions/components/promotions-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER_MANAGER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.promotions");
  return { title: t("title") };
}

export default async function PromotionsPage() {
  const [t, guard] = await Promise.all([
    getTranslations("pages.promotions"),
    guardPage({ roles: OWNER_MANAGER, feature: "promotions" }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      {guard.ok ? (
        <PromotionsView orgId={guard.ctx.organizationId} />
      ) : guard.reason === "upgrade" ? (
        <UpgradeState />
      ) : (
        <ForbiddenState />
      )}
    </>
  );
}
