import { Lock, ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "./empty-state";

export async function UpgradeState() {
  const t = await getTranslations("access");
  return (
    <EmptyState
      icon={Lock}
      title={t("upgradeTitle")}
      description={t("upgradeDescription")}
    />
  );
}

export async function ForbiddenState() {
  const t = await getTranslations("access");
  return (
    <EmptyState
      icon={ShieldX}
      title={t("forbiddenTitle")}
      description={t("forbiddenDescription")}
    />
  );
}
