import Decimal from "decimal.js";

// Money is always handled as Decimal in memory and as a 2dp string at the
// edges (DB numeric(12,2), JSON). Never use JS floats for money.
export const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_UP });
export type Money = Decimal;
export type MoneyInput = Decimal.Value;

export const ZERO = new Money(0);

export function money(value: MoneyInput | null | undefined): Decimal {
  return new Money(value ?? 0);
}

/** Round half-up to 2 decimals. */
export function round2(value: MoneyInput): Decimal {
  return new Money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** 2dp string for DB/JSON. */
export function toMoneyString(value: MoneyInput): string {
  return round2(value).toFixed(2);
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), new Money(0));
}

export function minMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return Decimal.min(new Money(a), new Money(b));
}
