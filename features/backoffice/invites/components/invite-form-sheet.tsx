"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { useErrorText } from "@/components/form/field-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { EmailLocale, EntitlementFeatures } from "@/db/schema";
import {
  DEFAULT_PRESET,
  INVITE_PRESETS,
  type InvitePresetKey,
  LIMIT_KEYS,
} from "@/lib/backoffice/presets";
import type { ErrorCode } from "@/lib/errors";
import { useErrorMessage } from "@/lib/use-error-message";
import {
  FeaturesEditor,
  LimitsEditor,
  type LimitsValue,
} from "../../components/entitlements-editor";
import { fromLimitField, toLimitField } from "../../shared/entitlement-schemas";
import { createInvite, updateInvite } from "../actions";
import type { InviteDTO } from "../queries";
import {
  createInviteSchema,
  INVITE_DEFAULT_EXPIRY_DAYS,
  INVITE_MAX_EXPIRY_DAYS,
  updateInviteSchema,
} from "../schemas";

type FormValues = {
  label: string;
  email: string;
  lockToEmail: boolean;
  expiresInDays: string;
  emailLocale: EmailLocale;
  limits: LimitsValue;
  features: EntitlementFeatures;
};

function presetValues(key: InvitePresetKey) {
  const p = INVITE_PRESETS[key];
  return {
    limits: Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, toLimitField(p.limits[k])]),
    ) as LimitsValue,
    features: { ...p.features },
  };
}

function initialValues(invite?: InviteDTO): FormValues {
  if (!invite) {
    return {
      label: "",
      email: "",
      lockToEmail: true,
      expiresInDays: String(INVITE_DEFAULT_EXPIRY_DAYS),
      emailLocale: "th",
      ...presetValues(DEFAULT_PRESET),
    };
  }
  const daysLeft = Math.ceil(
    (new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000,
  );
  return {
    label: invite.label,
    email: invite.email ?? "",
    lockToEmail: invite.lockToEmail,
    expiresInDays: String(
      Math.min(INVITE_MAX_EXPIRY_DAYS, Math.max(1, daysLeft)),
    ),
    emailLocale: invite.emailLocale,
    limits: Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, toLimitField(invite.limits[k])]),
    ) as LimitsValue,
    features: { ...invite.features },
  };
}

function toInput(v: FormValues) {
  return {
    label: v.label,
    email: v.email,
    lockToEmail: v.lockToEmail,
    expiresInDays: Number(v.expiresInDays),
    emailLocale: v.emailLocale,
    limits: Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, fromLimitField(v.limits[k])]),
    ),
    features: v.features,
  };
}

/** Create (invite = undefined) or edit an invite. */
export function InviteFormSheet({
  invite,
  onClose,
  onLink,
}: {
  invite?: InviteDTO;
  onClose: () => void;
  /** Called with the new signup URL after "Create & copy link". */
  onLink: (url: string) => void;
}) {
  const t = useTranslations("backoffice.invites");
  const tb = useTranslations("backoffice");
  const errorText = useErrorText();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const delivery = useRef<"email" | "link">("email");
  const [limitErrors, setLimitErrors] = useState<
    Partial<Record<keyof LimitsValue, string>>
  >({});
  const [preset, setPreset] = useState<InvitePresetKey | "">(
    invite ? "" : DEFAULT_PRESET,
  );
  const editing = !!invite;

  const form = useAppForm({
    defaultValues: initialValues(invite),
    validators: {
      onSubmit: ({ value }) => {
        const input = toInput(value);
        const r = editing
          ? updateInviteSchema.safeParse({ ...input, id: invite.id })
          : createInviteSchema.safeParse({
              ...input,
              delivery: delivery.current,
            });
        const limits: Partial<Record<keyof LimitsValue, string>> = {};
        const fields: Record<string, { message: string }> = {};
        if (!r.success) {
          for (const issue of r.error.issues) {
            const [head, key] = issue.path.map(String);
            if (head === "limits") {
              limits[key as keyof LimitsValue] = errorText(issue);
            } else {
              fields[head] = { message: issue.message };
            }
          }
        }
        setLimitErrors(limits);
        return Object.keys(fields).length || Object.keys(limits).length
          ? { fields }
          : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const input = toInput(value);
      const fail = (r: {
        code: ErrorCode;
        details?: Record<string, string | number>;
      }) => {
        toast.error(errorMessage(r.code, r.details));
        // An email failure still created the invite: close so it can be retried.
        if (r.code === "EMAIL_SEND_FAILED") onClose();
      };
      const refresh = () =>
        queryClient.invalidateQueries({ queryKey: ["backoffice", "invites"] });

      if (editing) {
        const r = await updateInvite({ ...input, id: invite.id });
        refresh();
        if (!r.ok) return fail(r);
        toast.success(t("saved"));
        return onClose();
      }
      const r = await createInvite({ ...input, delivery: delivery.current });
      refresh();
      if (!r.ok) return fail(r);
      if (r.data.url) onLink(r.data.url);
      else toast.success(t("sentTo", { email: value.email }));
      onClose();
    },
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>
            {editing ? t("editDescription") : t("createDescription")}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          id="invite-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="grid gap-5 p-4"
        >
          <form.AppField name="label">
            {(f) => (
              <f.TextField
                label={t("label")}
                placeholder={t("labelPlaceholder")}
              />
            )}
          </form.AppField>
          <div className="grid gap-3 sm:grid-cols-2">
            <form.AppField name="email">
              {(f) => (
                <f.TextField
                  label={t("recipientEmail")}
                  type="email"
                  autoComplete="off"
                />
              )}
            </form.AppField>
            <form.AppField name="expiresInDays">
              {(f) => (
                <f.TextField
                  label={t("expiresInDays")}
                  inputMode="numeric"
                  hint={t("expiresHint", { max: INVITE_MAX_EXPIRY_DAYS })}
                />
              )}
            </form.AppField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field name="lockToEmail">
              {(f) => (
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5">
                  <Label htmlFor="invite-lock" className="grid gap-0.5">
                    <span className="font-medium text-sm">
                      {t("lockToEmail")}
                    </span>
                    <span className="font-normal text-muted-foreground text-xs">
                      {t("lockToEmailHint")}
                    </span>
                  </Label>
                  <Switch
                    id="invite-lock"
                    checked={f.state.value}
                    onCheckedChange={f.handleChange}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="emailLocale">
              {(f) => (
                <div className="grid gap-1.5">
                  <Label>{t("emailLanguage")}</Label>
                  <ToggleGroup
                    type="single"
                    value={f.state.value}
                    onValueChange={(v) => v && f.handleChange(v as EmailLocale)}
                    className="w-fit rounded-full border bg-card p-0.5"
                    aria-label={t("emailLanguage")}
                  >
                    {(["th", "en"] as const).map((l) => (
                      <ToggleGroupItem
                        key={l}
                        value={l}
                        className="h-9 rounded-full px-4 text-sm data-[state=on]:bg-foreground data-[state=on]:text-background"
                      >
                        {t(`language.${l}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid gap-2">
            <Label id="preset-label">{t("preset")}</Label>
            <ToggleGroup
              type="single"
              value={preset}
              aria-labelledby="preset-label"
              onValueChange={(v) => {
                if (!v) return;
                const key = v as InvitePresetKey;
                setPreset(key);
                const values = presetValues(key);
                form.setFieldValue("limits", values.limits);
                form.setFieldValue("features", values.features);
                setLimitErrors({});
              }}
              className="flex w-full flex-wrap gap-2"
            >
              {(Object.keys(INVITE_PRESETS) as InvitePresetKey[]).map((k) => (
                <ToggleGroupItem
                  key={k}
                  value={k}
                  className="h-10 flex-1 rounded-full border px-4 data-[state=on]:border-gold data-[state=on]:bg-gold-soft data-[state=on]:text-gold-text"
                >
                  {t(`presets.${k}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-muted-foreground text-xs">{t("presetHint")}</p>
          </div>

          <form.Field name="limits">
            {(f) => (
              <LimitsEditor
                value={f.state.value}
                onChange={(v) => {
                  setPreset("");
                  f.handleChange(v);
                }}
                errors={limitErrors}
              />
            )}
          </form.Field>
          <form.Field name="features">
            {(f) => (
              <FeaturesEditor
                value={f.state.value}
                onChange={(v) => {
                  setPreset("");
                  f.handleChange(v);
                }}
              />
            )}
          </form.Field>
        </form>
        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) =>
              editing ? (
                <Button
                  type="submit"
                  form="invite-form"
                  disabled={submitting}
                  className="h-12 rounded-full"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {tb("common.save")}
                </Button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="submit"
                    form="invite-form"
                    disabled={submitting}
                    onClick={() => {
                      delivery.current = "email";
                    }}
                    className="h-12 rounded-full"
                  >
                    {submitting && delivery.current === "email" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {t("createAndSend")}
                  </Button>
                  <Button
                    type="submit"
                    form="invite-form"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => {
                      delivery.current = "link";
                    }}
                    className="h-12 rounded-full"
                  >
                    {submitting && delivery.current === "link" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    {t("createAndCopy")}
                  </Button>
                </div>
              )
            }
          </form.Subscribe>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
