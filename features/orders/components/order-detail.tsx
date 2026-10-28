"use client";

import { ArrowLeft, BadgePercent, History, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { ProductThumb } from "@/components/common/product-thumb";
import { StatusPill } from "@/components/common/status-pill";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { ApiError } from "@/lib/api/client";
import { useDateTime, useMoney } from "@/lib/format";
import type { MemberRole } from "@/lib/roles";
import { useErrorMessage } from "@/lib/use-error-message";
import { useOrder } from "../hooks";
import { OrderActions } from "./order-actions";

export function OrderDetail({
  orgId,
  orderId,
  role,
  userId,
}: {
  orgId: string;
  orderId: string;
  role: MemberRole;
  userId: string;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("channels");
  const tp = useTranslations("paymentType");
  const tm = useTranslations("paymentMethod");
  const ta = useTranslations("orders.audit");
  const money = useMoney();
  const { dateTime } = useDateTime();
  const errorMessage = useErrorMessage();
  const { data: order, isPending, error } = useOrder(orgId, orderId);

  if (isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <EmptyState title={errorMessage((error as ApiError | null)?.code)} />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/orders"
          className="flex size-11 items-center justify-center rounded-full border bg-card"
          aria-label={t("back")}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-semibold text-2xl">
            {order.orderNumber} <StatusPill status={order.status} />
          </h1>
          <p className="text-muted-foreground text-sm">
            {dateTime(order.createdAt)} · {tc(order.salesChannel)} ·{" "}
            {order.customerName}
            {order.staffName && ` · ${order.staffName}`}
          </p>
        </div>
        <OrderActions
          orgId={orgId}
          order={order}
          role={role}
          userId={userId}
          showView={false}
          variant="buttons"
        />
      </div>

      {order.deletedAt && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary bg-primary-soft p-4 text-sm">
          <Trash2 className="mt-0.5 size-4 text-primary" aria-hidden />
          <div>
            <p className="font-medium text-primary">
              {t("deletedBanner", {
                name: order.deletedByName ?? "—",
                time: dateTime(order.deletedAt),
              })}
            </p>
            <p>
              {t("reason")}: {order.deleteReason}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section
          className="rounded-2xl border bg-card p-4 shadow-card"
          aria-labelledby="items-title"
        >
          <h2 id="items-title" className="mb-3 font-semibold">
            {t("items")}
          </h2>
          <ul className="grid gap-3">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3">
                <ProductThumb src={i.imageUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{i.productName}</p>
                    <p className="font-semibold tabular-nums">
                      {money(i.lineTotal)}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {money(i.unitPrice)} × {i.quantity}
                    {Number(i.discountAmount) > 0 && (
                      <span className="ml-2 text-gold-text">
                        −{money(i.discountAmount)}
                      </span>
                    )}
                  </p>
                  {i.allocations && i.allocations.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.allocations.map((a) => (
                        <span
                          key={a.lotNumber}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums"
                        >
                          {a.lotNumber} × {a.quantity}
                          {a.cost !== undefined && ` @ ${money(a.cost)}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {order.promotions.length > 0 && (
            <>
              <Separator className="my-4" />
              <ul className="grid gap-2">
                {order.promotions.map((p) => (
                  <li
                    key={p.promotionName}
                    className="flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm"
                  >
                    <BadgePercent
                      className="size-4 text-gold-text"
                      aria-hidden
                    />
                    <span className="flex-1">{p.promotionName}</span>
                    <span className="font-medium text-gold-text tabular-nums">
                      −{money(p.discountAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="grid content-start gap-4">
          <section
            className="grid gap-1.5 rounded-2xl border bg-card p-4 text-sm shadow-card"
            aria-labelledby="totals-title"
          >
            <h2 id="totals-title" className="mb-1 font-semibold text-base">
              {t("totals")}
            </h2>
            <Row label={t("subtotal")} value={money(order.subtotal)} />
            {Number(order.discountTotal) > 0 && (
              <Row
                label={t("discount")}
                value={`−${money(order.discountTotal)}`}
              />
            )}
            {Number(order.serviceChargeAmount) > 0 && (
              <Row
                label={t("serviceCharge", {
                  rate: Number(order.serviceChargeRate),
                })}
                value={money(order.serviceChargeAmount)}
              />
            )}
            {order.vatMode !== "none" && (
              <Row
                label={t(
                  order.vatMode === "inclusive" ? "vatIncluded" : "vat",
                  { rate: Number(order.vatRate) },
                )}
                value={money(order.vatAmount)}
              />
            )}
            <Separator className="my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{t("total")}</span>
              <span className="font-bold text-2xl text-gold-text tabular-nums">
                {money(order.total)}
              </span>
            </div>
          </section>
          <section
            className="grid gap-1.5 rounded-2xl border bg-card p-4 text-sm shadow-card"
            aria-labelledby="payment-title"
          >
            <h2 id="payment-title" className="mb-1 font-semibold text-base">
              {t("payment")}
            </h2>
            <Row label={t("paymentType")} value={tp(order.paymentType)} />
            {order.paymentMethod && (
              <Row label={t("paymentMethod")} value={tm(order.paymentMethod)} />
            )}
            {order.cashReceived && (
              <Row
                label={t("cashReceived")}
                value={money(order.cashReceived)}
              />
            )}
            {order.changeAmount && (
              <Row label={t("change")} value={money(order.changeAmount)} />
            )}
            {order.paidAt && (
              <Row label={t("paidAt")} value={dateTime(order.paidAt)} />
            )}
          </section>
        </div>
      </div>

      <section
        className="rounded-2xl border bg-card p-4 shadow-card"
        aria-labelledby="audit-title"
      >
        <h2
          id="audit-title"
          className="mb-3 flex items-center gap-2 font-semibold"
        >
          <History className="size-4" aria-hidden /> {t("auditLog")}
        </h2>
        <ol className="relative grid gap-4 border-l pl-5">
          {order.audit.map((a) => (
            <li key={a.id} className="relative">
              <span
                className="-left-[27px] absolute top-1.5 size-3 rounded-full border-2 border-card bg-gold"
                aria-hidden
              />
              <p className="font-medium text-sm">
                {ta(a.action)}{" "}
                <span className="font-normal text-muted-foreground">
                  · {a.actorName ?? "—"}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                {dateTime(a.createdAt)}
              </p>
              {a.reason && (
                <p className="mt-1 text-sm">
                  {t("reason")}: {a.reason}
                </p>
              )}
              <AuditChange before={a.before} after={a.after} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

/** Compact summary of before/after for the timeline. */
function AuditChange({ before, after }: { before: unknown; after: unknown }) {
  const t = useTranslations("orders");
  const ts = useTranslations("orderStatus");
  const money = useMoney();
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (
    typeof b.status === "string" &&
    typeof a.status === "string" &&
    b.status !== a.status
  ) {
    parts.push(`${ts(b.status as never)} → ${ts(a.status as never)}`);
  }
  if (
    typeof b.total === "string" &&
    typeof a.total === "string" &&
    b.total !== a.total
  ) {
    parts.push(`${t("total")}: ${money(b.total)} → ${money(a.total)}`);
  }
  if (Array.isArray(b.items) && Array.isArray(a.items)) {
    const qty = (items: unknown[]) =>
      (items as { quantity: number }[]).reduce((n, i) => n + i.quantity, 0);
    if (qty(b.items) !== qty(a.items))
      parts.push(`${t("items")}: ${qty(b.items)} → ${qty(a.items)}`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="mt-1 text-muted-foreground text-xs">{parts.join(" · ")}</p>
  );
}
