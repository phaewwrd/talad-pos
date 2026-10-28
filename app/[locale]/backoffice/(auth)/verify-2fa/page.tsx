import { getTranslations } from "next-intl/server";
import { BackofficeAuthCard } from "@/features/backoffice/auth/components/backoffice-auth-card";
import { VerifyTwoFactorForm } from "@/features/backoffice/auth/components/verify-two-factor-form";

export async function generateMetadata() {
  const t = await getTranslations("backoffice.auth");
  return { title: t("verifyTitle") };
}

export default async function VerifyTwoFactorPage() {
  const t = await getTranslations("backoffice.auth");
  return (
    <BackofficeAuthCard title={t("verifyTitle")} subtitle={t("verifySubtitle")}>
      <VerifyTwoFactorForm />
    </BackofficeAuthCard>
  );
}
