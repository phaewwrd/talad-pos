import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BackofficeAuthCard } from "@/features/backoffice/auth/components/backoffice-auth-card";
import { SetupTwoFactor } from "@/features/backoffice/auth/components/setup-two-factor";
import { BackofficeForbidden } from "@/features/backoffice/components/backoffice-forbidden";
import { backofficePath, guardBackofficePage } from "@/lib/backoffice/guard";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.auth");
  return { title: t("setupTitle") };
}

export default async function SetupTwoFactorPage() {
  const t = await getTranslations("backoffice.auth");
  return (
    <BackofficeAuthCard title={t("setupTitle")} subtitle={t("setupSubtitle")}>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <Gate />
      </Suspense>
    </BackofficeAuthCard>
  );
}

async function Gate() {
  const r = await guardBackofficePage({ allowStage: "setup-2fa" });
  if (!r.ok) return <BackofficeForbidden />;
  // Already enrolled: nothing to set up.
  if (r.ctx.stage === "ready") redirect(await backofficePath(""));
  return <SetupTwoFactor />;
}
