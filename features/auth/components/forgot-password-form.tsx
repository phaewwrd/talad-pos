"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAppForm } from "@/components/form/app-form";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "../schemas";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [sent, setSent] = useState(false);

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onSubmit: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      // Always show the same message so emails can't be enumerated.
      await authClient.requestPasswordReset({
        email: value.email.trim().toLowerCase(),
        redirectTo: `/${locale}/reset-password`,
      });
      setSent(true);
    },
  });

  if (sent) {
    return (
      <div className="grid gap-4 text-center">
        <MailCheck className="mx-auto size-10 text-success" aria-hidden />
        <p>{t("resetSent")}</p>
        <Link href="/login" className="text-gold-text text-sm hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid gap-4"
    >
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("email")}
            type="email"
            autoComplete="email"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("sendResetLink")}</form.SubmitButton>
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
