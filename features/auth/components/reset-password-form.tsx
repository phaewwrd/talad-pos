"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "../schemas";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        toast.error(t("resetInvalid"));
        return;
      }
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (error) {
        toast.error(t("resetInvalid"));
        return;
      }
      toast.success(t("resetDone"));
      router.replace("/login");
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid gap-4"
    >
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppField name="confirmPassword">
        {(field) => (
          <field.TextField
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("resetTitle")}</form.SubmitButton>
      </form.AppForm>
      <Link
        href="/login"
        className="text-center text-gold-text text-sm hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </form>
  );
}
