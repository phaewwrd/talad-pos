"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/lib/use-error-message";
import {
  confirmTwoFactorEnrollment,
  startTwoFactorEnrollment,
} from "../actions";
import { confirmTwoFactorSchema, startTwoFactorSchema } from "../schemas";
import { useBackofficeNext } from "./use-backoffice-nav";

type Enrollment = { totpURI: string; secret: string; backupCodes: string[] };

export function SetupTwoFactor() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  return enrollment ? (
    <ConfirmStep enrollment={enrollment} />
  ) : (
    <PasswordStep onStarted={setEnrollment} />
  );
}

function PasswordStep({ onStarted }: { onStarted: (e: Enrollment) => void }) {
  const t = useTranslations("backoffice.auth");
  const errorMessage = useErrorMessage();
  const form = useAppForm({
    defaultValues: { password: "" },
    validators: { onSubmit: startTwoFactorSchema },
    onSubmit: async ({ value }) => {
      const r = await startTwoFactorEnrollment(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      onStarted(r.data);
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
      <p className="text-muted-foreground text-sm">{t("setupPasswordHint")}</p>
      <form.AppField name="password">
        {(f) => (
          <f.TextField
            label={t("password")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("continue")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

function ConfirmStep({ enrollment }: { enrollment: Enrollment }) {
  const t = useTranslations("backoffice.auth");
  const errorMessage = useErrorMessage();
  const goNext = useBackofficeNext();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(enrollment.totpURI, { width: 400, margin: 1 }).then(
      (url) => !cancelled && setQr(url),
    );
    return () => {
      cancelled = true;
    };
  }, [enrollment.totpURI]);

  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onSubmit: confirmTwoFactorSchema },
    onSubmit: async ({ value }) => {
      const r = await confirmTwoFactorEnrollment(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      toast.success(t("enabled"));
      goNext(r.data.next);
    },
  });

  return (
    <div className="grid gap-5">
      <div className="grid justify-items-center gap-3">
        <p className="text-center text-sm">{t("scanQr")}</p>
        {qr ? (
          // biome-ignore lint/performance/noImgElement: data URL, no optimization needed
          <img
            src={qr}
            alt={t("qrAlt")}
            width={200}
            height={200}
            className="rounded-xl border bg-white p-2"
          />
        ) : (
          <Skeleton className="size-[200px] rounded-xl" />
        )}
        <details className="w-full text-sm">
          <summary className="cursor-pointer text-gold-text">
            {t("manualSecret")}
          </summary>
          <code className="mt-2 block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
            {enrollment.secret}
          </code>
        </details>
      </div>

      <section className="grid gap-2 rounded-2xl border bg-gold-soft/50 p-4">
        <h2 className="font-medium">{t("backupTitle")}</h2>
        <p className="text-muted-foreground text-xs">{t("backupHint")}</p>
        <ul className="grid grid-cols-2 gap-1 font-mono text-sm tabular-nums">
          {enrollment.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full"
          onClick={async () => {
            await navigator.clipboard.writeText(
              enrollment.backupCodes.join("\n"),
            );
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("copied") : t("copyCodes")}
        </Button>
      </section>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid gap-4"
      >
        <form.AppField name="code">
          {(f) => (
            <f.TextField
              label={t("confirmCode")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="[&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.4em]"
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton>{t("enable")}</form.SubmitButton>
        </form.AppForm>
      </form>
    </div>
  );
}
