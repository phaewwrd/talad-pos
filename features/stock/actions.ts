"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productStockLots, products, stockAdjustments } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { AppError, runAction } from "@/lib/errors";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { syncProductStock } from "@/lib/stock/db";
import { stockChanged } from "@/lib/stock/version";
import { suggestLotNumber } from "./queries";
import { adjustStockSchema, stockInSchema } from "./schemas";

async function lockProduct(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  productId: string,
) {
  const [product] = await tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.organizationId, organizationId),
      ),
    )
    .for("update");
  if (!product) throw new AppError("NOT_FOUND");
  return product;
}

export async function getLotSuggestion(productId: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const id = uuid.parse(productId);
    return { lotNumber: await suggestLotNumber(ctx.organizationId, id) };
  });
}

/** Stock-in: new FIFO lot + movement log + product stock sync, atomically. */
export async function stockIn(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const parsed = stockInSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const input = parsed.data;

    try {
      const result = await db.transaction(async (tx) => {
        await lockProduct(tx, ctx.organizationId, input.productId);
        const [lot] = await tx
          .insert(productStockLots)
          .values({
            organizationId: ctx.organizationId,
            productId: input.productId,
            lotNumber: input.lotNumber,
            stockInDate: input.stockInDate,
            expiryDate: input.expiryDate,
            initialQuantity: input.quantity,
            remainingQuantity: input.quantity,
            cost: input.unitCost,
          })
          .returning({ id: productStockLots.id });
        await tx.insert(stockAdjustments).values({
          organizationId: ctx.organizationId,
          productId: input.productId,
          lotId: lot.id,
          type: "stock_in",
          quantity: input.quantity,
          actorId: ctx.user.id,
        });
        await syncProductStock(tx, [input.productId]);
        return { lotId: lot.id };
      });
      stockChanged(ctx.organizationId);
      return result;
    } catch (err) {
      if (
        isUniqueViolation(err, "product_stock_lots_product_id_lot_number_key")
      ) {
        throw new AppError("VALIDATION", { field: "lotNumber" });
      }
      throw err;
    }
  });
}

/** Manual adjustment of one lot (up / down / waste) with a mandatory reason. */
export async function adjustStock(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const parsed = adjustStockSchema.safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        parsed.error.issues.some((i) => i.path[0] === "reason")
          ? "REASON_REQUIRED"
          : "VALIDATION",
      );
    const input = parsed.data;

    const result = await db.transaction(async (tx) => {
      const product = await lockProduct(
        tx,
        ctx.organizationId,
        input.productId,
      );
      const [lot] = await tx
        .select()
        .from(productStockLots)
        .where(
          and(
            eq(productStockLots.id, input.lotId),
            eq(productStockLots.productId, input.productId),
            eq(productStockLots.organizationId, ctx.organizationId),
          ),
        )
        .for("update");
      if (!lot) throw new AppError("NOT_FOUND");

      const delta =
        input.type === "adjust_up" ? input.quantity : -input.quantity;
      if (lot.remainingQuantity + delta < 0) {
        throw new AppError("INSUFFICIENT_STOCK", {
          product: product.name,
          available: lot.remainingQuantity,
        });
      }
      await tx
        .update(productStockLots)
        .set({
          remainingQuantity: sql`${productStockLots.remainingQuantity} + ${delta}`,
          // Adding units grows the lot so remaining ≤ initial still holds.
          ...(delta > 0
            ? {
                initialQuantity: sql`${productStockLots.initialQuantity} + ${delta}`,
              }
            : {}),
        })
        .where(eq(productStockLots.id, lot.id));
      await tx.insert(stockAdjustments).values({
        organizationId: ctx.organizationId,
        productId: input.productId,
        lotId: lot.id,
        type: input.type,
        quantity: delta,
        reason: input.reason,
        actorId: ctx.user.id,
      });
      await syncProductStock(tx, [input.productId]);
      return { ok: true as const };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}
