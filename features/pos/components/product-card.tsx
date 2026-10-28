"use client";

import { BadgePercent, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductThumb } from "@/components/common/product-thumb";
import type { ProductDTO } from "@/features/catalog/types";
import { useMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  quantity,
  promoName,
  onAdd,
  onSet,
}: {
  product: ProductDTO;
  quantity: number;
  promoName: string | null;
  onAdd: () => void;
  onSet: (quantity: number) => void;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const out = product.stockQuantity <= 0;
  const low = !out && product.stockQuantity <= product.minimumStock;
  const selected = quantity > 0;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-card shadow-card transition-colors",
        selected && "border-primary",
        out && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={out}
        aria-label={t("addItem", { name: product.name })}
        className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
      >
        <ProductThumb
          src={product.imageUrl}
          size={320}
          className="!size-full rounded-none"
        />
        <span className="absolute top-2 left-2 flex flex-wrap gap-1">
          {promoName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 font-medium text-[11px] text-black">
              <BadgePercent className="size-3" aria-hidden /> {t("promo")}
            </span>
          )}
        </span>
        {(out || low) && (
          <span
            className={cn(
              "absolute top-2 right-2 rounded-full px-2 py-0.5 font-medium text-[11px]",
              out ? "bg-foreground text-background" : "bg-warning text-black",
            )}
          >
            {out
              ? t("outOfStock")
              : t("lowStock", { count: product.stockQuantity })}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 min-h-10 font-medium text-sm leading-5">
          {product.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-semibold text-gold-text tabular-nums">
            {money(product.price)}
          </span>
          {selected ? (
            <div className="flex items-center gap-1 rounded-full bg-primary-soft p-0.5">
              <button
                type="button"
                onClick={() => onSet(quantity - 1)}
                aria-label={t("decrease", { name: product.name })}
                className="flex size-9 items-center justify-center rounded-full bg-card text-primary"
              >
                <Minus className="size-4" />
              </button>
              <span
                className="min-w-6 text-center font-semibold tabular-nums"
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={onAdd}
                disabled={quantity >= product.stockQuantity}
                aria-label={t("increase", { name: product.name })}
                className="flex size-9 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={out}
              className="flex h-9 items-center gap-1 rounded-full bg-foreground px-3 font-medium text-background text-sm disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden /> {t("add")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
