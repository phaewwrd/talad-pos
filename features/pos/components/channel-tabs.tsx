"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SalesChannel } from "@/db/app-schema";
import { SALES_CHANNELS } from "@/features/orders/schemas";
import { cn } from "@/lib/utils";

export function ChannelTabs({
  value,
  onChange,
  platformChannels,
}: {
  value: SalesChannel;
  onChange: (channel: SalesChannel) => void;
  platformChannels: boolean;
}) {
  const t = useTranslations("channels");
  const tp = useTranslations("pos");
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div
        role="tablist"
        aria-label={tp("salesChannel")}
        className="flex w-max gap-1 rounded-full border bg-card p-1"
      >
        {SALES_CHANNELS.map((c) => {
          const locked = c !== "storefront" && !platformChannels;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={value === c}
              disabled={locked}
              title={locked ? tp("upgradeChannels") : undefined}
              onClick={() => onChange(c)}
              className={cn(
                "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-5 font-medium text-sm transition-colors",
                value === c
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                locked && "opacity-50",
              )}
            >
              {locked && <Lock className="size-3" aria-hidden />}
              {t(c)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
