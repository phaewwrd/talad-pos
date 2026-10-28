import type { VatMode } from "@/db/app-schema";
import { money, round2, sumMoney, toMoneyString, ZERO } from "@/lib/money";
import { applyPromotions, type PromotionRule } from "@/lib/promotions/apply";

export type OrderLineInput = {
  productId: string;
  categoryId: string;
  productName: string;
  /** From the DB at order time — never from the client. */
  unitPrice: string;
  quantity: number;
};

export type CalculateOrderInput = {
  lines: OrderLineInput[];
  promotions: PromotionRule[];
  /** Promotions the cashier removed from this order. */
  excludedPromotionIds?: readonly string[];
  serviceCharge: { enabled: boolean; rate: string };
  vat: { mode: VatMode; rate: string };
  now: Date;
};

export type CalculatedLine = OrderLineInput & {
  lineSubtotal: string;
  discountAmount: string;
  /** lineSubtotal − discountAmount (before service charge / VAT). */
  lineTotal: string;
  promotionId: string | null;
};

export type CalculatedPromotion = {
  promotionId: string;
  promotionName: string;
  discountType: PromotionRule["discountType"];
  discountValue: string;
  minimumType: PromotionRule["minimumType"];
  minimumQuantity: number;
  minimumAmount: string | null;
  matchedQuantity: number;
  discountAmount: string;
  lineIndexes: number[];
};

export type CalculatedOrder = {
  lines: CalculatedLine[];
  promotions: CalculatedPromotion[];
  subtotal: string;
  discountTotal: string;
  afterDiscount: string;
  serviceChargeRate: string;
  serviceChargeAmount: string;
  vatMode: VatMode;
  vatRate: string;
  vatAmount: string;
  total: string;
};

/**
 * Server-side source of truth for order totals.
 *
 * 1. lineSubtotal = unitPrice × qty
 * 2. promotion discounts (no stacking, best for customer) → discountTotal
 * 3. afterDiscount = subtotal − discountTotal
 * 4. service charge = afterDiscount × rate
 * 5. VAT on (afterDiscount + service): inclusive extracts it, exclusive adds it
 * 6. half-up to 2dp at line level and final total; rates are snapshotted.
 */
export function calculateOrder(input: CalculateOrderInput): CalculatedOrder {
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Invalid quantity for ${line.productId}`);
    }
    if (money(line.unitPrice).isNegative()) {
      throw new RangeError(`Invalid price for ${line.productId}`);
    }
  }

  const subtotals = input.lines.map((l) =>
    round2(money(l.unitPrice).times(l.quantity)),
  );

  const promo = applyPromotions(
    input.lines.map((l, i) => ({
      productId: l.productId,
      categoryId: l.categoryId,
      quantity: l.quantity,
      lineSubtotal: subtotals[i],
    })),
    input.promotions,
    { now: input.now, excludedPromotionIds: input.excludedPromotionIds },
  );

  const subtotal = sumMoney(subtotals);
  const discountTotal = sumMoney(promo.lineDiscounts);
  const afterDiscount = subtotal.minus(discountTotal);

  const serviceChargeRate = input.serviceCharge.enabled
    ? money(input.serviceCharge.rate)
    : ZERO;
  const serviceChargeAmount = round2(
    afterDiscount.times(serviceChargeRate).dividedBy(100),
  );

  const vatMode = input.vat.mode;
  const vatRate = vatMode === "none" ? ZERO : money(input.vat.rate);
  const taxable = afterDiscount.plus(serviceChargeAmount);
  let vatAmount = ZERO;
  if (vatMode === "inclusive") {
    vatAmount = round2(taxable.times(vatRate).dividedBy(vatRate.plus(100)));
  } else if (vatMode === "exclusive") {
    vatAmount = round2(taxable.times(vatRate).dividedBy(100));
  }
  const total = round2(
    vatMode === "exclusive" ? taxable.plus(vatAmount) : taxable,
  );

  return {
    lines: input.lines.map((line, i) => ({
      ...line,
      lineSubtotal: toMoneyString(subtotals[i]),
      discountAmount: toMoneyString(promo.lineDiscounts[i]),
      lineTotal: toMoneyString(subtotals[i].minus(promo.lineDiscounts[i])),
      promotionId: promo.linePromotionIds[i],
    })),
    promotions: promo.applied.map((a) => ({
      promotionId: a.promotion.id,
      promotionName: a.promotion.name,
      discountType: a.promotion.discountType,
      discountValue: toMoneyString(a.promotion.discountValue),
      minimumType: a.promotion.minimumType,
      minimumQuantity: a.promotion.minimumQuantity,
      minimumAmount: a.promotion.minimumAmount,
      matchedQuantity: a.matchedQuantity,
      discountAmount: toMoneyString(a.discountAmount),
      lineIndexes: a.lineIndexes,
    })),
    subtotal: toMoneyString(subtotal),
    discountTotal: toMoneyString(discountTotal),
    afterDiscount: toMoneyString(afterDiscount),
    serviceChargeRate: toMoneyString(serviceChargeRate),
    serviceChargeAmount: toMoneyString(serviceChargeAmount),
    vatMode,
    vatRate: toMoneyString(vatRate),
    vatAmount: toMoneyString(vatAmount),
    total: toMoneyString(total),
  };
}
