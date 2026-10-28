import type Decimal from "decimal.js";
import type { DiscountType, MinimumType } from "@/db/app-schema";
import { minMoney, money, round2, sumMoney, ZERO } from "@/lib/money";

export type PromotionRule = {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: string;
  minimumType: MinimumType;
  minimumQuantity: number;
  minimumAmount: string | null;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
  productIds: readonly string[];
  categoryIds: readonly string[];
};

export type PromotionLine = {
  productId: string;
  categoryId: string;
  quantity: number;
  /** unitPrice × quantity, already rounded. */
  lineSubtotal: Decimal;
};

export type AppliedPromotion = {
  promotion: PromotionRule;
  lineIndexes: number[];
  matchedQuantity: number;
  matchedSubtotal: Decimal;
  discountAmount: Decimal;
};

export type PromotionResult = {
  applied: AppliedPromotion[];
  /** Discount per input line (same order), sums to Σ applied.discountAmount. */
  lineDiscounts: Decimal[];
  /** Promotion id applied to each line, or null. */
  linePromotionIds: (string | null)[];
};

/** Above this many conflict combinations we fall back to a greedy choice. */
const MAX_COMBINATIONS = 4096;

export function isPromotionLive(promo: PromotionRule, now: Date) {
  const t = now.getTime();
  return (
    promo.isActive && promo.startAt.getTime() <= t && t <= promo.endAt.getTime()
  );
}

export function promotionMatches(
  promo: Pick<PromotionRule, "productIds" | "categoryIds">,
  line: Pick<PromotionLine, "productId" | "categoryId">,
) {
  return (
    promo.productIds.includes(line.productId) ||
    promo.categoryIds.includes(line.categoryId)
  );
}

/** Discount a promotion gives on a matched group (0 if the minimum isn't met). */
export function promotionDiscount(
  promo: PromotionRule,
  matchedQuantity: number,
  matchedSubtotal: Decimal,
): Decimal {
  if (matchedQuantity <= 0) return ZERO;
  if (promo.minimumType === "quantity") {
    if (matchedQuantity < promo.minimumQuantity) return ZERO;
  } else if (matchedSubtotal.lessThan(money(promo.minimumAmount))) {
    return ZERO;
  }

  const value = money(promo.discountValue);
  if (promo.discountType === "percentage") {
    const pct = minMoney(value, 100);
    return round2(matchedSubtotal.times(pct).dividedBy(100));
  }
  // TODO(decision): fixed discounts apply once per order, not per multiple of the minimum.
  return round2(minMoney(value, matchedSubtotal));
}

/**
 * Split `total` across lines proportionally to their subtotals, rounding each
 * share half-up and putting the rounding remainder on the largest line so the
 * shares always add up to exactly `total`.
 */
export function distributeProportionally(
  total: Decimal,
  subtotals: Decimal[],
): Decimal[] {
  const base = sumMoney(subtotals);
  if (base.isZero() || total.isZero()) return subtotals.map(() => ZERO);

  const shares = subtotals.map((s) => round2(total.times(s).dividedBy(base)));
  const remainder = total.minus(sumMoney(shares));
  if (!remainder.isZero()) {
    let largest = 0;
    subtotals.forEach((s, i) => {
      if (s.greaterThan(subtotals[largest])) largest = i;
    });
    shares[largest] = shares[largest].plus(remainder);
  }
  return shares;
}

function evaluate(
  lines: PromotionLine[],
  promos: PromotionRule[],
  assignment: (number | null)[],
): { total: Decimal; applied: AppliedPromotion[] } {
  const applied: AppliedPromotion[] = [];
  let total = ZERO;
  promos.forEach((promotion, p) => {
    const lineIndexes = assignment.flatMap((a, i) => (a === p ? [i] : []));
    if (lineIndexes.length === 0) return;
    const matchedQuantity = lineIndexes.reduce(
      (n, i) => n + lines[i].quantity,
      0,
    );
    const matchedSubtotal = sumMoney(
      lineIndexes.map((i) => lines[i].lineSubtotal),
    );
    const discountAmount = promotionDiscount(
      promotion,
      matchedQuantity,
      matchedSubtotal,
    );
    if (discountAmount.isZero()) return;
    total = total.plus(discountAmount);
    applied.push({
      promotion,
      lineIndexes,
      matchedQuantity,
      matchedSubtotal,
      discountAmount,
    });
  });
  return { total, applied };
}

/**
 * Pick promotions for an order. Each line gets at most one promotion (no
 * stacking); the line→promotion assignment that gives the customer the
 * largest total discount wins.
 *
 * Within one promotion, including more matching lines never lowers its
 * discount (percentage grows, fixed is capped by subtotal, minimums are
 * monotone), so only lines matching several promotions need searching.
 */
export function applyPromotions(
  lines: PromotionLine[],
  promotions: PromotionRule[],
  options: { now: Date; excludedPromotionIds?: readonly string[] },
): PromotionResult {
  const excluded = new Set(options.excludedPromotionIds ?? []);
  const promos = promotions
    .filter((p) => !excluded.has(p.id) && isPromotionLive(p, options.now))
    .sort((a, b) => a.id.localeCompare(b.id)); // deterministic tie-breaks

  const candidates = lines.map((line) =>
    promos.flatMap((p, idx) => (promotionMatches(p, line) ? [idx] : [])),
  );

  const assignment: (number | null)[] = candidates.map((c) =>
    c.length === 1 ? c[0] : null,
  );
  const conflicts = candidates.flatMap((c, i) => (c.length > 1 ? [i] : []));
  const combinations = conflicts.reduce((n, i) => n * candidates[i].length, 1);

  let best = evaluate(lines, promos, assignment);

  if (conflicts.length > 0 && combinations <= MAX_COMBINATIONS) {
    const walk = (k: number) => {
      if (k === conflicts.length) {
        const result = evaluate(lines, promos, assignment);
        if (result.total.greaterThan(best.total)) best = result;
        return;
      }
      const lineIndex = conflicts[k];
      for (const p of candidates[lineIndex]) {
        assignment[lineIndex] = p;
        walk(k + 1);
      }
      assignment[lineIndex] = null;
    };
    best = { total: ZERO, applied: [] };
    walk(0);
  } else if (conflicts.length > 0) {
    // Greedy fallback: give each conflicting line to its most generous promo.
    for (const i of conflicts) {
      let choice = candidates[i][0];
      let bestValue = ZERO;
      for (const p of candidates[i]) {
        assignment[i] = p;
        const v = evaluate(lines, promos, assignment).total;
        if (v.greaterThan(bestValue)) {
          bestValue = v;
          choice = p;
        }
      }
      assignment[i] = choice;
    }
    best = evaluate(lines, promos, assignment);
  }

  const lineDiscounts = lines.map(() => ZERO);
  const linePromotionIds: (string | null)[] = lines.map(() => null);
  for (const a of best.applied) {
    const shares = distributeProportionally(
      a.discountAmount,
      a.lineIndexes.map((i) => lines[i].lineSubtotal),
    );
    a.lineIndexes.forEach((lineIndex, k) => {
      lineDiscounts[lineIndex] = shares[k];
      linePromotionIds[lineIndex] = a.promotion.id;
    });
  }

  return { applied: best.applied, lineDiscounts, linePromotionIds };
}

/** Promotions that currently apply to a product (for POS card badges). */
export function promotionsForProduct(
  promotions: PromotionRule[],
  product: { productId: string; categoryId: string },
  now: Date,
) {
  return promotions.filter(
    (p) => isPromotionLive(p, now) && promotionMatches(p, product),
  );
}
