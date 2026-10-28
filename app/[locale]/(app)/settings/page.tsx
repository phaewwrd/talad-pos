import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/features/settings/components/settings-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const [t, guard] = await Promise.all([
    getTranslations("pages.settings"),
    guardPage({ roles: OWNER }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} />
      {guard.ok ? (
        <SettingsView orgId={guard.ctx.organizationId} />
      ) : (
        <ForbiddenState />
      )}
    </>
  );
}
