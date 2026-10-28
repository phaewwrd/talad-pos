import { notFound, redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReceiptActions } from "@/features/orders/components/receipt-actions";
import { getReceipt } from "@/features/orders/receipt";
import { AppError } from "@/lib/errors";
import { money as dec, toMoneyString } from "@/lib/money";
import { requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { SHOP_TIME_ZONE } from "@/lib/time";

export async function generateMetadata() {
  const t = await getTranslations("receipt");
  return { title: t("title") };
}

export default function ReceiptPage(
  props: PageProps<"/[locale]/receipt/[id]">,
) {
  return (
    <div className="min-h-dvh bg-muted/40 py-6 print:bg-white print:py-0">
      <Suspense fallback={null}>
        <Receipt {...props} />
      </Suspense>
    </div>
  );
}

async function Receipt({
  params,
  searchParams,
}: PageProps<"/[locale]/receipt/[id]">) {
  const [{ id }, { w }] = await Promise.all([params, searchParams]);
  const width = w === "58" ? 58 : 80;
  const orderId = uuid.safeParse(id);
  if (!orderId.success) notFound();

  let data: Awaited<ReturnType<typeof getReceipt>>;
  try {
    data = await getReceipt(await requireMember(), orderId.data);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    redirect(`/${await rootLocale()}/login`);
  }
  const { order, shop } = data;
  const t = await getTranslations("receipt");
  const tp = await getTranslations("paymentMethod");
  const tc = await getTranslations("channels");
  const format = await getFormatter();
  const money = (v: string | null) =>
    format.number(Number(v ?? 0), {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    });

  return (
    <>
      <style>{`@page { size: ${width}mm auto; margin: 0; } @media print { body { background: #fff; } }`}</style>
      <ReceiptActions width={width} />
      <article
        className="mx-auto bg-white p-3 font-mono text-[11px] text-black leading-snug shadow-card print:shadow-none"
        style={{ width: `${width}mm` }}
      >
        <header className="text-center">
          <p className="font-bold text-sm">{shop?.displayName}</p>
          {shop?.address && <p>{shop.address}</p>}
          {shop?.phone && (
            <p>
              {t("phone")}: {shop.phone}
            </p>
          )}
          {shop?.taxId && (
            <p>
              {t("taxId")}: {shop.taxId}
            </p>
          )}
          {shop?.receiptHeader && (
            <p className="mt-1 whitespace-pre-line">{shop.receiptHeader}</p>
          )}
        </header>
        <hr className="my-2 border-black border-dashed" />
        <div className="grid gap-0.5">
          <Row label={t("orderNo")} value={order.orderNumber} />
          <Row
            label={t("date")}
            value={format.dateTime(new Date(order.createdAt), {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: SHOP_TIME_ZONE,
            })}
          />
          <Row label={t("channel")} value={tc(order.salesChannel)} />
          <Row label={t("customer")} value={order.customerName} />
          {order.staffName && (
            <Row label={t("staff")} value={order.staffName} />
          )}
        </div>
        <hr className="my-2 border-black border-dashed" />
        <ul className="grid gap-1">
          {order.items.map((i) => (
            <li key={i.id}>
              <p>{i.productName}</p>
              <Row
                label={`  ${i.quantity} × ${money(i.unitPrice)}`}
                value={money(toMoneyString(dec(i.unitPrice).times(i.quantity)))}
              />
              {Number(i.discountAmount) > 0 && (
                <Row
                  label={`  ${t("discount")}`}
                  value={`-${money(i.discountAmount)}`}
                />
              )}
            </li>
          ))}
        </ul>
        <hr className="my-2 border-black border-dashed" />
        <div className="grid gap-0.5">
          <Row label={t("subtotal")} value={money(order.subtotal)} />
          {order.promotions.map((p) => (
            <Row
              key={p.promotionName}
              label={p.promotionName}
              value={`-${money(p.discountAmount)}`}
            />
          ))}
          {Number(order.serviceChargeAmount) > 0 && (
            <Row
              label={t("serviceCharge", {
                rate: Number(order.serviceChargeRate),
              })}
              value={money(order.serviceChargeAmount)}
            />
          )}
          {order.vatMode === "exclusive" && (
            <Row
              label={t("vat", { rate: Number(order.vatRate) })}
              value={money(order.vatAmount)}
            />
          )}
          <Row label={t("total")} value={money(order.total)} bold />
          {order.vatMode === "inclusive" && (
            <>
              <Row
                label={t("beforeVat")}
                value={money(
                  toMoneyString(dec(order.total).minus(order.vatAmount)),
                )}
              />
              <Row
                label={t("vatIncluded", { rate: Number(order.vatRate) })}
                value={money(order.vatAmount)}
              />
            </>
          )}
        </div>
        <hr className="my-2 border-black border-dashed" />
        {order.paymentType === "Paid" ? (
          <div className="grid gap-0.5">
            <Row
              label={t("paidBy")}
              value={order.paymentMethod ? tp(order.paymentMethod) : "—"}
            />
            {order.cashReceived && (
              <Row
                label={t("cashReceived")}
                value={money(order.cashReceived)}
              />
            )}
            {order.changeAmount && (
              <Row label={t("change")} value={money(order.changeAmount)} />
            )}
          </div>
        ) : (
          <p className="text-center font-bold">{t("unpaid")}</p>
        )}
        {order.status === "Cancelled" && (
          <p className="mt-1 text-center font-bold">{t("cancelled")}</p>
        )}
        {shop?.receiptFooter && (
          <p className="mt-3 whitespace-pre-line text-center">
            {shop.receiptFooter}
          </p>
        )}
        <p className="mt-2 text-center">{t("thankYou")}</p>
      </article>
    </>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${bold ? "font-bold text-xs" : ""}`}
    >
      <span className="min-w-0 whitespace-pre-wrap break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
