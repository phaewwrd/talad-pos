import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";

export async function BackofficeForbidden() {
  const t = await getTranslations("backoffice.forbidden");
  return (
    <EmptyState
      icon={ShieldX}
      title={t("title")}
      description={t("description")}
    />
  );
}
