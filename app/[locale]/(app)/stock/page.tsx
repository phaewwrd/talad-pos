import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata() {
  const t = await getTranslations("pages.stock");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("pages.stock.title")} />
      <EmptyState title={t("common.comingSoon")} />
    </>
  );
}
