"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/** One generic message for unknown, disabled and regenerated links. */
export function LinkUnavailable({
  reason = "unavailable",
}: {
  reason?: "unavailable" | "rateLimited";
}) {
  const t = useTranslations("supplierView");
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <LinkIcon className="size-6" aria-hidden />
      </span>
      <p className="font-medium">
        {reason === "rateLimited" ? t("rateLimited") : t("unavailable")}
      </p>
      {reason === "unavailable" && (
        <p className="max-w-xs text-muted-foreground text-sm">
          {t("unavailableHint")}
        </p>
      )}
    </div>
  );
}
