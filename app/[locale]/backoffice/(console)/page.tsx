import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.dashboard");
  return { title: t("title") };
}

export default async function BackofficeDashboardPage() {
  const t = await getTranslations("backoffice.dashboard");
  return <PageHeader title={t("title")} description={t("description")} />;
}
