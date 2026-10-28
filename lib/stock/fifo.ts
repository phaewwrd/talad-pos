import { money, sumMoney, toMoneyString } from "@/lib/money";

// Pure FIFO allocation logic. The DB layer locks lots with SELECT … FOR UPDATE,
// calls these functions, then persists the result in the same transaction.

export type FifoLot = {
  id: string;
  /** `YYYY-MM-DD` */
  stockInDate: string;
  createdAt: Date;
  remainingQuantity: number;
};

export type LotAllocation = { lotId: string; quantity: number };

export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";
  constructor(
    readonly productId: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super(
      `Insufficient stock for ${productId}: requested ${requested}, available ${available}`,
    );
  }
}

/** Oldest stock first: stock_in_date, then created_at. */
export function sortLotsFifo<T extends FifoLot>(lots: readonly T[]): T[] {
  return [...lots].sort(
    (a, b) =>
      a.stockInDate.localeCompare(b.stockInDate) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

// TODO(decision): expired lots are still sold FIFO; expiry only raises alerts.
export function allocateFifo(
  productId: string,
  lots: readonly FifoLot[],
  quantity: number,
): LotAllocation[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError(`Invalid quantity: ${quantity}`);
  }
  const available = lots.reduce((n, l) => n + l.remainingQuantity, 0);
  if (available < quantity) {
    throw new InsufficientStockError(productId, quantity, available);
  }

  const allocations: LotAllocation[] = [];
  let left = quantity;
  for (const lot of sortLotsFifo(lots)) {
    if (left === 0) break;
    const take = Math.min(lot.remainingQuantity, left);
    if (take > 0) {
      allocations.push({ lotId: lot.id, quantity: take });
      left -= take;
    }
  }
  return allocations;
}

/**
 * Units to give back when an item's quantity is reduced by `quantity`.
 * Returns go to the same lots the units came from, newest allocation first,
 * so the remaining allocation stays the oldest (FIFO) stock.
 */
export function releaseAllocations(
  allocations: readonly LotAllocation[],
  quantity: number,
): { released: LotAllocation[]; kept: LotAllocation[] } {
  const total = allocations.reduce((n, a) => n + a.quantity, 0);
  if (quantity < 0 || quantity > total) {
    throw new RangeError(`Cannot release ${quantity} of ${total}`);
  }

  const kept = allocations.map((a) => ({ ...a }));
  const released: LotAllocation[] = [];
  let left = quantity;
  for (let i = kept.length - 1; i >= 0 && left > 0; i--) {
    const take = Math.min(kept[i].quantity, left);
    released.push({ lotId: kept[i].lotId, quantity: take });
    kept[i].quantity -= take;
    left -= take;
  }
  return { released, kept: kept.filter((a) => a.quantity > 0) };
}

/** Merge allocations per lot (e.g. before writing them). */
export function mergeAllocations(
  allocations: readonly LotAllocation[],
): LotAllocation[] {
  const byLot = new Map<string, number>();
  for (const a of allocations) {
    byLot.set(a.lotId, (byLot.get(a.lotId) ?? 0) + a.quantity);
  }
  return [...byLot].map(([lotId, quantity]) => ({ lotId, quantity }));
}

/** Real COGS = Σ(allocation.quantity × lot.cost). */
export function costOfGoodsSold(
  allocations: readonly { quantity: number; lotCost: string }[],
): string {
  return toMoneyString(
    sumMoney(allocations.map((a) => money(a.lotCost).times(a.quantity))),
  );
}
