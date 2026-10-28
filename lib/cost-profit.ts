import { money, round2, toMoneyString, ZERO } from "@/lib/money";

// TODO(decision): platform_fee_rate (numeric(6,4)) stores a percentage, e.g. 30.0000 = 30%.

/** Revenue, platform fee, cost, net profit and margin % of one platform entry. */
export function entryProfit(e: {
  quantity: number;
  unitCost: string;
  unitPrice: string;
  platformFeeRate: string;
}) {
  const revenue = money(e.unitPrice).times(e.quantity);
  const fee = round2(revenue.times(e.platformFeeRate).dividedBy(100));
  const cost = money(e.unitCost).times(e.quantity);
  const net = revenue.minus(fee).minus(cost);
  return {
    revenue: toMoneyString(revenue),
    fee: toMoneyString(fee),
    cost: toMoneyString(cost),
    netProfit: toMoneyString(net),
    marginPercent: revenue.isZero()
      ? "0.00"
      : toMoneyString(net.dividedBy(revenue).times(100)),
  };
}

export function marginPercent(revenue: string, profit: string) {
  const r = money(revenue);
  return r.isZero()
    ? "0.00"
    : toMoneyString(money(profit).dividedBy(r).times(100));
}

/**
 * Selling price so that, after the platform fee, the target margin (of the
 * selling price) remains: price = cost / (1 − fee% − margin%).
 * Returns null when fee + margin ≥ 100% (no price can satisfy it).
 */
export function suggestPrice(input: {
  cost: string;
  feePercent: string;
  targetMarginPercent: string;
}) {
  const keep = money(100)
    .minus(input.feePercent)
    .minus(input.targetMarginPercent);
  if (keep.lessThanOrEqualTo(ZERO)) return null;
  const price = round2(money(input.cost).times(100).dividedBy(keep));
  const fee = round2(price.times(input.feePercent).dividedBy(100));
  const profit = price.minus(fee).minus(input.cost);
  return {
    price: toMoneyString(price),
    fee: toMoneyString(fee),
    profitPerUnit: toMoneyString(profit),
    marginPercent: price.isZero()
      ? "0.00"
      : toMoneyString(profit.dividedBy(price).times(100)),
  };
}
