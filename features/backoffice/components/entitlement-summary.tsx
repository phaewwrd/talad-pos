"use client";

import { useLocale, useTranslations } from "next-intl";
import type { EntitlementFeatures, EntitlementLimits } from "@/db/schema";
import { FEATURE_KEYS } from "@/lib/backoffice/presets";

export function useLimitText() {
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  return (v: number | null) => (v === null ? "∞" : fmt.format(v));
}

/** "1 shop · 10 staff · 1,000 products" + enabled feature chips. */
export function EntitlementSummary({
  limits,
  features,
}: {
  limits: EntitlementLimits;
  features: EntitlementFeatures;
}) {
  const t = useTranslations("backoffice");
  const n = useLimitText();
  const enabled = FEATURE_KEYS.filter((k) => features[k]);
  return (
    <div className="grid gap-1">
      <span className="whitespace-nowrap text-xs tabular-nums">
        {t("limits.short", {
          shops: n(limits.maxShops),
          staff: n(limits.maxStaffPerShop),
          products: n(limits.maxProducts),
        })}
      </span>
      <span className="flex flex-wrap gap-1">
        {enabled.length === 0 ? (
          <span className="text-muted-foreground text-xs">
            {t("noFeatures")}
          </span>
        ) : (
          enabled.map((k) => (
            <span
              key={k}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t(`features.${k}`)}
            </span>
          ))
        )}
      </span>
    </div>
  );
}
