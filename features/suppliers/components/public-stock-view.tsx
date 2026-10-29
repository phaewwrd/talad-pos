"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ProductThumb } from "@/components/common/product-thumb";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PublicStock, StockStatus } from "../types";
import { pollingTransport, useLiveStock } from "../use-live-stock";
import { LinkUnavailable } from "./link-unavailable";

const FILTERS = ["all", "low", "out"] as const;

const STATUS_STYLES: Record<StockStatus, string> = {
  in: "bg-success/15 text-success",
  low: "bg-warning/15 text-[#9a6608]",
  out: "bg-primary/10 text-primary",
};

export function PublicStockView({
  token,
  initial,
}: {
  token: string;
  initial: PublicStock;
}) {
  const t = useTranslations("supplierView");
  const transport = useMemo(() => pollingTransport(token), [token]);
  const { stock, checkedAt, connected, gone, changed } = useLiveStock(
    initial,
    transport,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  useEffect(() => {
    // The PIN changed: reload so the server shows the PIN screen again.
    if (gone === "locked") window.location.reload();
  }, [gone]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.items.filter(
      (i) =>
        (filter === "all" || i.status === filter) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q)),
    );
  }, [stock.items, query, filter]);

  if (gone === "unavailable") return <LinkUnavailable />;

  const counts = {
    all: stock.items.length,
    low: stock.items.filter((i) => i.status === "low").length,
    out: stock.items.filter((i) => i.status === "out").length,
  };

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <p className="text-muted-foreground text-sm">{stock.shopName}</p>
        <h1 className="font-semibold text-xl leading-tight">
          {t("heading", { supplier: stock.supplierName })}
        </h1>
        <LiveIndicator
          // Restart the "seconds ago" clock on every successful check.
          key={checkedAt}
          checkedAt={checkedAt}
          connected={connected}
        />
      </header>

      <div className="sticky top-0 z-10 -mx-4 grid gap-2 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <Search
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-11 rounded-full pl-9"
          />
        </div>
        <fieldset className="flex gap-2">
          <legend className="sr-only">{t("filter")}</legend>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm transition-colors",
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card",
              )}
            >
              {t(`filters.${f}`)} · {counts[f]}
            </button>
          ))}
        </fieldset>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card px-4 py-12 text-center text-muted-foreground text-sm">
          {stock.items.length === 0 ? t("noProducts") : t("noMatches")}
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.sku}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card transition-colors duration-700",
                changed.has(item.sku) && "bg-gold-soft",
              )}
            >
              <ProductThumb src={item.imageUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {item.sku}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.quantity !== null && (
                  <span className="font-semibold text-lg tabular-nums leading-none">
                    {item.quantity}
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-xs",
                    STATUS_STYLES[item.status],
                  )}
                >
                  {t(`status.${item.status}`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LiveIndicator({
  checkedAt,
  connected,
}: {
  checkedAt: number;
  connected: boolean;
}) {
  const t = useTranslations("supplierView");
  const [now, setNow] = useState(checkedAt);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.round((now - checkedAt) / 1000));

  return (
    <p
      className="flex items-center gap-2 text-muted-foreground text-xs"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        {connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            connected ? "bg-success" : "bg-muted-foreground",
          )}
        />
      </span>
      {connected ? t("live") : t("reconnecting")} ·{" "}
      {seconds < 5 ? t("updatedJustNow") : t("updatedAgo", { seconds })}
    </p>
  );
}
