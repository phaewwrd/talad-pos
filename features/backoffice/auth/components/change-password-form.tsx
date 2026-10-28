"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { useErrorMessage } from "@/lib/use-error-message";
import { changeBackofficePassword } from "../actions";
import { changePasswordSchema } from "../schemas";
import { useBackofficeNext } from "./use-backoffice-nav";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations("backoffice.auth");
  const errorMessage = useErrorMessage();
  const goNext = useBackofficeNext();

  const form = useAppForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: { onSubmit: changePasswordSchema },
    onSubmit: async ({ value }) => {
      const r = await changeBackofficePassword(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      toast.success(t("changed"));
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
      {forced && (
        <output className="block rounded-xl bg-gold-soft px-3 py-2 text-gold-text text-sm">
          {t("forcedChange")}
        </output>
      )}
      <form.AppField name="currentPassword">
        {(f) => (
          <f.TextField
            label={t("currentPassword")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="newPassword">
        {(f) => (
          <f.TextField
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            hint={t("changeSubtitle")}
          />
        )}
      </form.AppField>
      <form.AppField name="confirmPassword">
        {(f) => (
          <f.TextField
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("changeSubmit")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
