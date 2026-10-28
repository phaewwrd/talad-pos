import { getTranslations } from "next-intl/server";
import { InvitesView } from "@/features/admin/components/invites-view";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("invites") };
}

export default function AdminInvitesPage() {
  return <InvitesView />;
}
