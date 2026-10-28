import { getTranslations } from "next-intl/server";
import { InvitesView } from "@/features/backoffice/invites/components/invites-view";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.invites");
  return { title: t("title") };
}

// Access is enforced by the (console) layout and every route / action.
export default function BackofficeInvitesPage() {
  return <InvitesView />;
}
