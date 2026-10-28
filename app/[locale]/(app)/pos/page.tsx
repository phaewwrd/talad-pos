import { getTranslations } from "next-intl/server";
import { PosScreen } from "@/features/pos/components/pos-screen";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.pos");
  return { title: t("title") };
}

export default async function PosPage() {
  const ctx = await requireMember();
  return <PosScreen orgId={ctx.organizationId} />;
}
