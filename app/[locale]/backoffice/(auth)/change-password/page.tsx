import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/common/access-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BackofficeAuthCard } from "@/features/backoffice/auth/components/backoffice-auth-card";
import { ChangePasswordForm } from "@/features/backoffice/auth/components/change-password-form";
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
  if (!r.ok) return <ForbiddenState />;
  return <ChangePasswordForm forced={r.ctx.stage === "change-password"} />;
}
