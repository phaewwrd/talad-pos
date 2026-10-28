"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { useErrorMessage } from "@/lib/use-error-message";
import { backofficeLogin } from "../actions";
import { backofficeLoginSchema } from "../schemas";
import { useBackofficeNext } from "./use-backoffice-nav";

export function BackofficeLoginForm() {
  const t = useTranslations("backoffice.auth");
  const errorMessage = useErrorMessage();
  const goNext = useBackofficeNext();
  const expired = useSearchParams().get("expired") === "1";

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: backofficeLoginSchema },
    onSubmit: async ({ value }) => {
      const r = await backofficeLogin(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      goNext(r.data.next);
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
      {expired && (
        <output className="block rounded-xl bg-gold-soft px-3 py-2 text-gold-text text-sm">
          {t("expired")}
        </output>
      )}
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("email")}
            type="email"
            autoComplete="username"
            inputMode="email"
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("password")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("login")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
