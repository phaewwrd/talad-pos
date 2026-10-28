"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "../schemas";

function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/pos";
}

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email({
        email: value.email.trim().toLowerCase(),
        password: value.password,
      });
      if (error) {
        toast.error(t("loginFailed"));
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNext(next));
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
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t("email")}
            type="email"
            autoComplete="email"
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
      <div className="-mt-1 text-right">
        <Link
          href="/forgot-password"
          className="text-gold-text text-sm hover:underline"
        >
          {t("forgotPassword")}
        </Link>
      </div>
      <form.AppForm>
        <form.SubmitButton>{t("login")}</form.SubmitButton>
      </form.AppForm>
      <Link
        href="/pin"
        className="flex h-12 items-center justify-center rounded-full border font-medium text-sm hover:bg-muted"
      >
        {t("staffPin")}
      </Link>
    </form>
  );
}
