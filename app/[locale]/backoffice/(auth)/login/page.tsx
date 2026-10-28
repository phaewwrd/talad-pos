import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BackofficeAuthCard } from "@/features/backoffice/auth/components/backoffice-auth-card";
import { BackofficeLoginForm } from "@/features/backoffice/auth/components/backoffice-login-form";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.auth");
  return { title: t("loginTitle") };
}

export default async function BackofficeLoginPage() {
  const t = await getTranslations("backoffice.auth");
  return (
    <BackofficeAuthCard title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <BackofficeLoginForm />
      </Suspense>
    </BackofficeAuthCard>
  );
}
