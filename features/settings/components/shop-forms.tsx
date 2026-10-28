"use client";

import { useStore } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppForm } from "@/components/form/app-form";
import { ImageUpload } from "@/components/upload/image-upload";
import { useRouter } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-error-message";
import { saveShopSettings, saveTaxSettings } from "../actions";
import { issuesToFields, useInvalidateSettings } from "../hooks";
import type { SettingsDTO } from "../queries";
import { shopSettingsSchema, taxSettingsSchema } from "../schemas";

export function ShopForm({
  orgId,
  settings,
}: {
  orgId: string;
  settings: SettingsDTO | null;
}) {
  const t = useTranslations("settings");
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateSettings(orgId);
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {
      displayName: settings?.displayName ?? "",
      logoUrl: settings?.logoUrl ?? null,
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
      taxId: settings?.taxId ?? "",
      promptpayId: settings?.promptpayId ?? "",
      orderNumberPrefix: settings?.orderNumberPrefix ?? "TL",
      receiptHeader: settings?.receiptHeader ?? "",
      receiptFooter: settings?.receiptFooter ?? "",
      expiryAlertDays: String(settings?.expiryAlertDays ?? 7),
    } as {
      displayName: string;
      logoUrl: string | null;
      address: string;
      phone: string;
      taxId: string;
      promptpayId: string;
      orderNumberPrefix: string;
      receiptHeader: string;
      receiptFooter: string;
      expiryAlertDays: string;
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = shopSettingsSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      const r = await saveShopSettings(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      toast.success(t("saved"));
      invalidate();
      router.refresh(); // top bar shop name / logo
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid max-w-2xl gap-4"
    >
      <form.Field name="logoUrl">
        {(field) => (
          <ImageUpload
            kind="logo"
            label={t("logo")}
            value={field.state.value}
            onChange={(url) => field.handleChange(url)}
          />
        )}
      </form.Field>
      <form.AppField name="displayName">
        {(f) => <f.TextField label={t("shopName")} />}
      </form.AppField>
      <form.AppField name="address">
        {(f) => <f.TextareaField label={t("address")} />}
      </form.AppField>
      <div className="grid gap-3 sm:grid-cols-2">
        <form.AppField name="phone">
          {(f) => <f.TextField label={t("phone")} inputMode="tel" />}
        </form.AppField>
        <form.AppField name="taxId">
          {(f) => (
            <f.TextField
              label={t("taxId")}
              inputMode="numeric"
              hint={t("taxIdHint")}
            />
          )}
        </form.AppField>
        <form.AppField name="promptpayId">
          {(f) => (
            <f.TextField
              label={t("promptpayId")}
              inputMode="numeric"
              hint={t("promptpayHint")}
            />
          )}
        </form.AppField>
        <form.AppField name="orderNumberPrefix">
          {(f) => (
            <f.TextField
              label={t("orderPrefix")}
              autoCapitalize="characters"
              hint={t("orderPrefixHint")}
            />
          )}
        </form.AppField>
      </div>
      <form.AppField name="receiptHeader">
        {(f) => <f.TextareaField label={t("receiptHeader")} />}
      </form.AppField>
      <form.AppField name="receiptFooter">
        {(f) => <f.TextareaField label={t("receiptFooter")} />}
      </form.AppField>
      <form.AppField name="expiryAlertDays">
        {(f) => (
          <f.TextField
            label={t("expiryAlertDays")}
            inputMode="numeric"
            className="max-w-48"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton className="h-12 w-full rounded-full sm:w-48">
          {t("save")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

export function TaxForm({
  orgId,
  settings,
}: {
  orgId: string;
  settings: SettingsDTO | null;
}) {
  const t = useTranslations("settings");
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateSettings(orgId);
  const form = useAppForm({
    defaultValues: {
      vatEnabled: settings?.vatEnabled ?? false,
      vatMode: (settings?.vatMode ?? "inclusive") as "inclusive" | "exclusive",
      vatRate: String(Number(settings?.vatRate ?? 7)),
      serviceChargeEnabled: settings?.serviceChargeEnabled ?? false,
      serviceChargeRate: String(Number(settings?.serviceChargeRate ?? 10)),
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = taxSettingsSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      const r = await saveTaxSettings(value);
      if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
      toast.success(t("saved"));
      invalidate();
    },
  });
  const values = useStore(form.store, (s) => s.values);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid max-w-xl gap-4"
    >
      <form.AppField name="vatEnabled">
        {(f) => <f.SwitchField label={t("vatEnabled")} hint={t("vatHint")} />}
      </form.AppField>
      {values.vatEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <form.AppField name="vatMode">
            {(f) => (
              <f.SelectField
                label={t("vatMode")}
                options={[
                  { value: "inclusive", label: t("vatInclusive") },
                  { value: "exclusive", label: t("vatExclusive") },
                ]}
              />
            )}
          </form.AppField>
          <form.AppField name="vatRate">
            {(f) => <f.TextField label={t("vatRate")} inputMode="decimal" />}
          </form.AppField>
        </div>
      )}
      <form.AppField name="serviceChargeEnabled">
        {(f) => (
          <f.SwitchField label={t("serviceEnabled")} hint={t("serviceHint")} />
        )}
      </form.AppField>
      {values.serviceChargeEnabled && (
        <form.AppField name="serviceChargeRate">
          {(f) => (
            <f.TextField
              label={t("serviceRate")}
              inputMode="decimal"
              className="max-w-48"
            />
          )}
        </form.AppField>
      )}
      <form.AppForm>
        <form.SubmitButton className="h-12 w-full rounded-full sm:w-48">
          {t("save")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
