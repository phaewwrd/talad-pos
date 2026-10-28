"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  categories,
  products,
  promotionCategories,
  promotionProducts,
  promotions,
} from "@/db/schema";
import { AppError, runAction } from "@/lib/errors";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { fromBangkokLocal } from "@/lib/time";
import { type PromotionInput, promotionSchema } from "./schemas";

async function context() {
  return requireMember({ roles: OWNER_MANAGER, feature: "promotions" });
}

function parse(raw: unknown) {
  const r = promotionSchema.safeParse(raw);
  if (!r.success) throw new AppError("VALIDATION");
  return r.data;
}

function values(input: ReturnType<typeof parse>) {
  return {
    name: input.name,
    discountType: input.discountType,
    discountValue: input.discountValue,
    minimumType: input.minimumType,
    minimumQuantity:
      input.minimumType === "quantity" ? input.minimumQuantity : 1,
    minimumAmount: input.minimumType === "amount" ? input.minimumAmount : null,
    startAt: fromBangkokLocal(input.startAt),
    endAt: fromBangkokLocal(input.endAt),
    isActive: input.isActive,
  };
}

/** Replace targets after checking every id belongs to this shop. */
async function writeTargets(
  tx: Tx,
  organizationId: string,
  promotionId: string,
  input: ReturnType<typeof parse>,
) {
  if (input.productIds.length) {
    const owned = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          inArray(products.id, input.productIds),
        ),
      );
    if (owned.length !== new Set(input.productIds).size)
      throw new AppError("VALIDATION");
  }
  if (input.categoryIds.length) {
    const owned = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.organizationId, organizationId),
          inArray(categories.id, input.categoryIds),
        ),
      );
    if (owned.length !== new Set(input.categoryIds).size)
      throw new AppError("VALIDATION");
  }
  await tx
    .delete(promotionProducts)
    .where(eq(promotionProducts.promotionId, promotionId));
  await tx
    .delete(promotionCategories)
    .where(eq(promotionCategories.promotionId, promotionId));
  if (input.productIds.length) {
    await tx.insert(promotionProducts).values(
      [...new Set(input.productIds)].map((productId) => ({
        organizationId,
        promotionId,
        productId,
      })),
    );
  }
  if (input.categoryIds.length) {
    await tx.insert(promotionCategories).values(
      [...new Set(input.categoryIds)].map((categoryId) => ({
        organizationId,
        promotionId,
        categoryId,
      })),
    );
  }
}

export async function createPromotion(raw: PromotionInput) {
  return runAction(async () => {
    const ctx = await context();
    const input = parse(raw);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(promotions)
        .values({ organizationId: ctx.organizationId, ...values(input) })
        .returning({ id: promotions.id });
      await writeTargets(tx, ctx.organizationId, row.id, input);
      return row;
    });
  });
}

export async function updatePromotion(id: unknown, raw: PromotionInput) {
  return runAction(async () => {
    const ctx = await context();
    const promotionId = uuid.parse(id);
    const input = parse(raw);
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(promotions)
        .set(values(input))
        .where(
          and(
            eq(promotions.id, promotionId),
            eq(promotions.organizationId, ctx.organizationId),
          ),
        )
        .returning({ id: promotions.id });
      if (!row) throw new AppError("NOT_FOUND");
      await writeTargets(tx, ctx.organizationId, row.id, input);
      return row;
    });
  });
}

export async function setPromotionActive(id: unknown, isActive: boolean) {
  return runAction(async () => {
    const ctx = await context();
    const promotionId = uuid.parse(id);
    const [row] = await db
      .update(promotions)
      .set({ isActive: Boolean(isActive) })
      .where(
        and(
          eq(promotions.id, promotionId),
          eq(promotions.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: promotions.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}

/** Past orders keep their snapshot (order_promotions.promotion_id → null). */
export async function deletePromotion(id: unknown) {
  return runAction(async () => {
    const ctx = await context();
    const promotionId = uuid.parse(id);
    const [row] = await db
      .delete(promotions)
      .where(
        and(
          eq(promotions.id, promotionId),
          eq(promotions.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: promotions.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}
