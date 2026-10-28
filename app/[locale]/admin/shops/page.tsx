import { getTranslations } from "next-intl/server";
import { AdminShopsView } from "@/features/admin/components/invites-view";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("shops") };
}

export default function AdminShopsPage() {
  return <AdminShopsView />;
}
