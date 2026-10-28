"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { signupWithInvite } from "../actions";
import { inviteSignupSchema } from "../schemas";

export function SignupForm({
  token,
  lockedEmail,
}: {
  token: string;
  lockedEmail: string | null;
}) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      token,
      name: "",
      shopName: "",
      email: lockedEmail ?? "",
      password: "",
      confirmPassword: "",
    },
    validators: { onSubmit: inviteSignupSchema },
    onSubmit: async ({ value }) => {
      const result = await signupWithInvite(value);
      if (!result.ok) {
        toast.error(errorMessage(result.code, result.details));
        return;
      }
      router.replace("/pos");
      router.refresh();
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
      <form.AppField name="name">
        {(field) => <field.TextField label={t("name")} autoComplete="name" />}
      </form.AppField>
      <form.AppField name="shopName">
        {(field) => (
          <field.TextField label={t("shopName")} autoComplete="organization" />
        )}
      </form.AppField>
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("email")}
            type="email"
            autoComplete="email"
            readOnly={lockedEmail !== null}
            hint={lockedEmail ? t("emailLocked") : undefined}
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label={t("password")}
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
        <form.SubmitButton>{t("createAccount")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
