"use client";

import {
  BadgePercent,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { PosBootstrapDTO } from "@/features/orders/types";
import { useMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Cart } from "../use-cart";

export function OrderSummary({
  data,
  cart,
  onPlaceOrder,
  placing,
  className,
}: {
  data: PosBootstrapDTO | undefined;
  cart: Cart;
  onPlaceOrder: () => void;
  placing: boolean;
  className?: string;
}) {
  const t = useTranslations("pos");
  const tp = useTranslations("paymentType");
  const money = useMoney();
  const { state, dispatch, lines, preview, removablePromotions } = cart;
  const linePreview = new Map(preview?.lines.map((l) => [l.productId, l]));

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg">{t("orderSummary")}</h2>
          <p className="text-muted-foreground text-xs tabular-nums">
            {t("orderNumber")}: {data?.nextOrderNumber ?? "—"}
          </p>
        </div>
        {lines.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            onClick={() => dispatch({ type: "reset" })}
          >
            <RotateCcw className="size-4" /> {t("clear")}
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label
          htmlFor="customer-name"
          className="text-muted-foreground text-xs"
        >
          {t("customerName")}
        </Label>
        <Input
          id="customer-name"
          value={state.customerName}
          onChange={(e) => dispatch({ type: "customer", name: e.target.value })}
          placeholder={t("walkIn")}
          maxLength={80}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ShoppingBag className="size-8" aria-hidden />
            <p className="text-sm">{t("emptyCart")}</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {lines.map(({ product, quantity }) => {
              const lp = linePreview.get(product.id);
              const discounted = lp && Number(lp.discountAmount) > 0;
              return (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl border bg-background/60 p-2"
                >
                  <ProductThumb src={product.imageUrl} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {product.name}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {money(product.price)} × {quantity}
                    </p>
                    <p className="font-semibold text-sm tabular-nums">
                      {discounted ? (
                        <>
                          <span className="mr-1 font-normal text-muted-foreground text-xs line-through">
                            {money(lp.lineSubtotal)}
                          </span>
                          {money(lp.lineTotal)}
                        </>
                      ) : (
                        money(lp?.lineSubtotal ?? 0)
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "remove", productId: product.id })
                      }
                      aria-label={t("removeItem", { name: product.name })}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "set",
                            productId: product.id,
                            quantity: quantity - 1,
                            max: product.stockQuantity,
                          })
                        }
                        aria-label={t("decrease", { name: product.name })}
                        className="flex size-8 items-center justify-center rounded-full border bg-card"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center font-semibold text-sm tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "add",
                            productId: product.id,
                            max: product.stockQuantity,
                          })
                        }
                        disabled={quantity >= product.stockQuantity}
                        aria-label={t("increase", { name: product.name })}
                        className="flex size-8 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview?.promotions.length || removablePromotions.length ? (
        <div className="mt-3 grid gap-1.5">
          {preview?.promotions.map((p) => (
            <div
              key={p.promotionId}
              className="flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm"
            >
              <BadgePercent
                className="size-4 shrink-0 text-gold-text"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{p.promotionName}</span>
              <span className="font-medium text-gold-text tabular-nums">
                −{money(p.discountAmount)}
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: "togglePromotion",
                    promotionId: p.promotionId,
                  })
                }
                aria-label={t("removePromotion", { name: p.promotionName })}
                className="flex size-7 items-center justify-center rounded-full hover:bg-white/60"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {removablePromotions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                dispatch({ type: "togglePromotion", promotionId: p.id })
              }
              className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-left text-muted-foreground text-sm"
            >
              <BadgePercent className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate line-through">{p.name}</span>
              <span className="text-xs">{t("reapply")}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-1.5 rounded-2xl bg-muted/60 p-3 text-sm">
        <SummaryRow
          label={t("subtotal")}
          value={money(preview?.subtotal ?? 0)}
        />
        {preview && Number(preview.discountTotal) > 0 && (
          <SummaryRow
            label={t("discount")}
            value={`−${money(preview.discountTotal)}`}
            className="text-gold-text"
          />
        )}
        {data?.pricing.serviceCharge.enabled && (
          <SummaryRow
            label={t("serviceCharge", {
              rate: Number(data.pricing.serviceCharge.rate),
            })}
            value={money(preview?.serviceChargeAmount ?? 0)}
          />
        )}
        {data && data.pricing.vat.mode !== "none" && (
          <SummaryRow
            label={t(
              data.pricing.vat.mode === "inclusive" ? "vatIncluded" : "vat",
              {
                rate: Number(data.pricing.vat.rate),
              },
            )}
            value={money(preview?.vatAmount ?? 0)}
          />
        )}
        <Separator className="my-1" />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{t("total")}</span>
          <span className="font-bold text-2xl text-gold-text tabular-nums">
            {money(preview?.total ?? 0)}
          </span>
        </div>
      </div>

      <fieldset
        className="mt-3 grid grid-cols-2 gap-1 rounded-full border bg-card p-1"
        aria-label={t("payment")}
      >
        {([true, false] as const).map((paid) => (
          <button
            key={String(paid)}
            type="button"
            aria-pressed={state.paid === paid}
            onClick={() => dispatch({ type: "paid", paid })}
            className={cn(
              "h-10 rounded-full font-medium text-sm",
              state.paid === paid
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {tp(paid ? "Paid" : "Unpaid")}
          </button>
        ))}
      </fieldset>

      <Button
        className="mt-3 h-14 w-full rounded-full font-semibold text-base hover:bg-primary-hover"
        disabled={lines.length === 0 || placing}
        onClick={onPlaceOrder}
      >
        {t("placeOrder")}
      </Button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
