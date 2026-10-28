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
} from "./fifo";

/** products.stock_quantity := Σ lots.remaining_quantity (same transaction). */
export async function syncProductStock(tx: Tx, productIds: string[]) {
  if (productIds.length === 0) return;
  await tx
    .update(products)
    .set({
      stockQuantity: sql`(SELECT COALESCE(SUM(${productStockLots.remainingQuantity}), 0) FROM ${productStockLots} WHERE ${productStockLots.productId} = ${products.id})`,
    })
    .where(inArray(products.id, [...new Set(productIds)]));
}

/** Lock a product's lots (FIFO order) for the rest of the transaction. */
export async function lockLots(
  tx: Tx,
  organizationId: string,
  productId: string,
) {
  return tx
    .select({
      id: productStockLots.id,
      stockInDate: productStockLots.stockInDate,
      createdAt: productStockLots.createdAt,
      remainingQuantity: productStockLots.remainingQuantity,
      cost: productStockLots.cost,
    })
    .from(productStockLots)
    .where(
      and(
        eq(productStockLots.organizationId, organizationId),
        eq(productStockLots.productId, productId),
      ),
    )
    .orderBy(asc(productStockLots.stockInDate), asc(productStockLots.createdAt))
    .for("update");
}

/**
 * Allocate `quantity` of a product FIFO for an order item, decrement lots and
 * record allocations. Throws INSUFFICIENT_STOCK (localized on the client).
 */
export async function allocateForItem(
  tx: Tx,
  input: {
    organizationId: string;
    orderItemId: string;
    productId: string;
    productName: string;
    quantity: number;
  },
): Promise<LotAllocation[]> {
  const lots = await lockLots(tx, input.organizationId, input.productId);
  let allocations: LotAllocation[];
  try {
    allocations = allocateFifo(input.productId, lots, input.quantity);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      throw new AppError("INSUFFICIENT_STOCK", {
        product: input.productName,
        available: err.available,
      });
    }
    throw err;
  }
  for (const a of allocations) {
    await tx
      .update(productStockLots)
      .set({
        remainingQuantity: sql`${productStockLots.remainingQuantity} - ${a.quantity}`,
      })
      .where(eq(productStockLots.id, a.lotId));
  }
  await tx.insert(orderItemLotAllocations).values(
    allocations.map((a) => ({
      organizationId: input.organizationId,
      orderItemId: input.orderItemId,
      lotId: a.lotId,
      quantity: a.quantity,
    })),
  );
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
