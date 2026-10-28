import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("resetTitle")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
