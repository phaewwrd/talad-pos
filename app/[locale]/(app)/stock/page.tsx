import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { StockView } from "@/features/stock/components/stock-view";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.stock");
  return { title: t("title") };
}

export default async function StockPage() {
  const [t, ctx] = await Promise.all([
    getTranslations("pages.stock"),
    requireMember(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      <StockView orgId={ctx.organizationId} role={ctx.role} />
    </>
  );
}
