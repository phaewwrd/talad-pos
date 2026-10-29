import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/common/access-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsView } from "@/features/settings/components/settings-view";
import { guardPage } from "@/lib/page-guard";
import { OWNER } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("pages.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("pages.settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const guard = await guardPage({ roles: OWNER });
  if (guard.ok) return <SettingsView orgId={guard.ctx.organizationId} />;
  return <ForbiddenState />;
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-11 w-full max-w-md rounded-full" />
      <Skeleton className="h-96 max-w-2xl rounded-2xl" />
    </div>
  );
}
