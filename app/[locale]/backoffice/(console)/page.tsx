import { getTranslations } from "next-intl/server";
import { DashboardView } from "@/features/backoffice/dashboard/components/dashboard-view";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.dashboard");
  return { title: t("title") };
}

export default function BackofficeDashboardPage() {
  return <DashboardView />;
}
