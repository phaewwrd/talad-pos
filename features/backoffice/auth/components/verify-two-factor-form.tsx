"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { verifyBackofficeTwoFactor } from "../actions";
import { verifyTwoFactorSchema } from "../schemas";
import { useBackofficeNext } from "./use-backoffice-nav";

export function VerifyTwoFactorForm() {
  const t = useTranslations("backoffice.auth");
  const errorMessage = useErrorMessage();
  const goNext = useBackofficeNext();
  const [method, setMethod] = useState<"totp" | "backup">("totp");

  const form = useAppForm({
    defaultValues: { code: "" },
    validators: {
      onSubmit: ({ value }) => {
        const r = verifyTwoFactorSchema.safeParse({ method, code: value.code });
        return r.success
          ? undefined
          : { fields: { code: { message: r.error.issues[0].message } } };
      },
    },
    onSubmit: async ({ value }) => {
      const r = await verifyBackofficeTwoFactor({ method, code: value.code });
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
      <form.AppField name="code">
        {(field) =>
          method === "totp" ? (
            <field.TextField
              label={t("code")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="[&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.4em]"
            />
          ) : (
            <field.TextField
              label={t("backupCode")}
              autoComplete="off"
              autoFocus
              className="[&_input]:font-mono"
            />
          )
        }
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("verify")}</form.SubmitButton>
      </form.AppForm>
      <Button
        type="button"
        variant="ghost"
        className="h-10 rounded-full text-gold-text"
        onClick={() => {
          setMethod((m) => (m === "totp" ? "backup" : "totp"));
          form.reset();
        }}
      >
        {method === "totp" ? t("useBackup") : t("useTotp")}
      </Button>
      <Link
        href="/backoffice/login"
        className="text-center text-muted-foreground text-sm hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </form>
  );
}
