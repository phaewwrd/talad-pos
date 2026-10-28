import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BackofficeAuthCard } from "@/features/backoffice/auth/components/backoffice-auth-card";
import { ChangePasswordForm } from "@/features/backoffice/auth/components/change-password-form";
import { BackofficeForbidden } from "@/features/backoffice/components/backoffice-forbidden";
import { guardBackofficePage } from "@/lib/backoffice/guard";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.auth");
  return { title: t("changeTitle") };
}

export default async function ChangePasswordPage() {
  const t = await getTranslations("backoffice.auth");
  return (
    <BackofficeAuthCard title={t("changeTitle")}>
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <Gate />
      </Suspense>
    </BackofficeAuthCard>
  );
}

async function Gate() {
  const r = await guardBackofficePage({ allowStage: "change-password" });
  if (!r.ok) return <BackofficeForbidden />;
  return <ChangePasswordForm forced={r.ctx.stage === "change-password"} />;
}
