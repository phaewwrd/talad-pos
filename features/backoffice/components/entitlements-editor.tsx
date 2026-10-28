"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EntitlementFeatures } from "@/db/schema";
import { FEATURE_KEYS, LIMIT_KEYS } from "@/lib/backoffice/presets";
import { cn } from "@/lib/utils";
import type { LimitField } from "../shared/entitlement-schemas";

export type LimitsValue = Record<(typeof LIMIT_KEYS)[number], LimitField>;

/** Number inputs with an "unlimited" toggle (unlimited = null). */
export function LimitsEditor({
  value,
  onChange,
  errors,
  warnings,
  disabled,
}: {
  value: LimitsValue;
  onChange: (next: LimitsValue) => void;
  errors?: Partial<Record<keyof LimitsValue, string>>;
  warnings?: Partial<Record<keyof LimitsValue, string>>;
  disabled?: boolean;
}) {
  const t = useTranslations("backoffice");
  const id = useId();
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3" disabled={disabled}>
      <legend className="mb-2 font-medium text-sm">{t("limits.title")}</legend>
      {LIMIT_KEYS.map((key) => {
        const field = value[key];
        const inputId = `${id}-${key}`;
        const error = errors?.[key];
        const warning = warnings?.[key];
        return (
          <div key={key} className="grid content-start gap-1.5">
            <Label htmlFor={inputId}>{t(`limits.${key}`)}</Label>
            <Input
              id={inputId}
              inputMode="numeric"
              value={field.unlimited ? "" : field.value}
              placeholder={field.unlimited ? "∞" : undefined}
              disabled={field.unlimited || disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: { ...field, value: e.target.value.replace(/\D/g, "") },
                })
              }
              aria-invalid={!!error}
              className="h-11 rounded-xl tabular-nums"
            />
            <div className="flex items-center gap-2">
              <Switch
                id={`${inputId}-unlimited`}
                checked={field.unlimited}
                onCheckedChange={(unlimited) =>
                  onChange({ ...value, [key]: { ...field, unlimited } })
                }
                aria-label={t("limits.unlimitedFor", {
                  limit: t(`limits.${key}`),
                })}
              />
              <Label
                htmlFor={`${inputId}-unlimited`}
                className="font-normal text-muted-foreground text-xs"
              >
                {t("limits.unlimited")}
              </Label>
            </div>
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
            {warning && <p className="text-[#9a6608] text-xs">{warning}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}

export function FeaturesEditor({
  value,
  onChange,
  disabled,
}: {
  value: EntitlementFeatures;
  onChange: (next: EntitlementFeatures) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("backoffice");
  const id = useId();
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2" disabled={disabled}>
      <legend className="mb-2 font-medium text-sm">{t("featuresTitle")}</legend>
      {FEATURE_KEYS.map((key) => (
        <div
          key={key}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5",
            value[key] && "border-gold/60 bg-gold-soft/40",
          )}
        >
          <Label htmlFor={`${id}-${key}`} className="font-normal">
            {t(`features.${key}`)}
          </Label>
          <Switch
            id={`${id}-${key}`}
            checked={value[key]}
            onCheckedChange={(v) => onChange({ ...value, [key]: v })}
          />
        </div>
      ))}
    </fieldset>
  );
}
