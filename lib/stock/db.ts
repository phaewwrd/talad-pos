import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  orderItemLotAllocations,
  productStockLots,
  products,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  allocateFifo,
  InsufficientStockError,
  type LotAllocation,
  mergeAllocations,
} from "./fifo";
import { bumpStockVersion } from "./version";

/**
 * products.stock_quantity := Σ lots.remaining_quantity, and bump the shop's
 * stock version (same transaction). Callers still call stockChanged() after
 * commit to expire the supplier-stock cache.
 */
export async function syncProductStock(tx: Tx, productIds: string[]) {
  if (productIds.length === 0) return;
  const rows = await tx
    .update(products)
    .set({
      stockQuantity: sql`(SELECT COALESCE(SUM(${productStockLots.remainingQuantity}), 0) FROM ${productStockLots} WHERE ${productStockLots.productId} = ${products.id})`,
    })
    .where(inArray(products.id, [...new Set(productIds)]))
    .returning({ organizationId: products.organizationId });
  for (const organizationId of new Set(rows.map((r) => r.organizationId))) {
    await bumpStockVersion(tx, organizationId);
  }
}

type AllocationRequest = {
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
};

/**
 * Allocate stock FIFO for several order items at once: lock every lot of
 * every product in one query, allocate in memory, then decrement lots and
 * record allocations with one statement each. Throws INSUFFICIENT_STOCK
 * (localized on the client). Returns allocations in request order.
 */
export async function allocateForItems(
  tx: Tx,
  organizationId: string,
  requests: readonly AllocationRequest[],
): Promise<LotAllocation[][]> {
  if (requests.length === 0) return [];
  const productIds = [...new Set(requests.map((r) => r.productId))].sort();
  const lots = await tx
    .select({
      id: productStockLots.id,
      productId: productStockLots.productId,
      stockInDate: productStockLots.stockInDate,
      createdAt: productStockLots.createdAt,
      remainingQuantity: productStockLots.remainingQuantity,
    })
    .from(productStockLots)
    .where(
      and(
        eq(productStockLots.organizationId, organizationId),
        inArray(productStockLots.productId, productIds),
      ),
    )
    .orderBy(
      asc(productStockLots.productId),
      asc(productStockLots.stockInDate),
      asc(productStockLots.createdAt),
    )
    .for("update");

  // Remaining quantity per lot, reduced as requests consume it (the same
  // product may be requested twice, e.g. when restoring an order).
  const lotsByProduct = new Map<string, (typeof lots)[number][]>();
  for (const lot of lots) {
    const list = lotsByProduct.get(lot.productId) ?? [];
    list.push({ ...lot });
    lotsByProduct.set(lot.productId, list);
  }

  const result = requests.map((r) => {
    const productLots = lotsByProduct.get(r.productId) ?? [];
    let allocations: LotAllocation[];
    try {
      allocations = allocateFifo(r.productId, productLots, r.quantity);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new AppError("INSUFFICIENT_STOCK", {
          product: r.productName,
          available: err.available,
        });
      }
      throw err;
    }
    for (const a of allocations) {
      const lot = productLots.find((l) => l.id === a.lotId);
      if (lot) lot.remainingQuantity -= a.quantity;
    }
    return allocations;
  });

  const perLot = mergeAllocations(result.flat());
  await tx.execute(sql`
    UPDATE ${productStockLots}
    SET remaining_quantity = ${productStockLots.remainingQuantity} - v.qty,
        updated_at = now()
    FROM (VALUES ${sql.join(
      perLot.map((a) => sql`(${a.lotId}::uuid, ${a.quantity}::int)`),
      sql`, `,
    )}) AS v(id, qty)
    WHERE ${productStockLots.id} = v.id
  `);
  await tx.insert(orderItemLotAllocations).values(
    requests.flatMap((r, i) =>
      result[i].map((a) => ({
        organizationId,
        orderItemId: r.orderItemId,
        lotId: a.lotId,
        quantity: a.quantity,
      })),
    ),
  );
  return result;
}

/** Allocate stock FIFO for one order item (see allocateForItems). */
export async function allocateForItem(
  tx: Tx,
  input: AllocationRequest & { organizationId: string },
): Promise<LotAllocation[]> {
  const [allocations] = await allocateForItems(tx, input.organizationId, [
    input,
  ]);
  return allocations;
}

/** Return allocated units to the exact lots they came from. */
export async function returnToLots(
  tx: Tx,
  allocations: readonly LotAllocation[],
) {
  for (const a of allocations) {
    if (a.quantity <= 0) continue;
    await tx
      .update(productStockLots)
      .set({
        remainingQuantity: sql`${productStockLots.remainingQuantity} + ${a.quantity}`,
      })
      .where(eq(productStockLots.id, a.lotId));
  }
}

/** Current allocations of order items, newest last (for release order). */
export async function loadAllocations(tx: Tx, orderItemIds: string[]) {
  if (orderItemIds.length === 0) return [];
  return tx
    .select({
      id: orderItemLotAllocations.id,
      orderItemId: orderItemLotAllocations.orderItemId,
      lotId: orderItemLotAllocations.lotId,
      quantity: orderItemLotAllocations.quantity,
    })
    .from(orderItemLotAllocations)
    .where(inArray(orderItemLotAllocations.orderItemId, orderItemIds))
    .orderBy(
      asc(orderItemLotAllocations.createdAt),
      asc(orderItemLotAllocations.id),
    );
}
