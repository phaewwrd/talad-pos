import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orderPromotions,
  orders,
  promotionCategories,
  promotionProducts,
  promotions,
} from "@/db/schema";
import type { PromotionDTO, PromotionState } from "./types";

export function promotionState(
  p: { isActive: boolean; startAt: Date; endAt: Date },
  now = new Date(),
): PromotionState {
  if (!p.isActive) return "inactive";
  if (p.endAt < now) return "expired";
  if (p.startAt > now) return "scheduled";
  return "active";
}

export async function listPromotions(
  organizationId: string,
): Promise<PromotionDTO[]> {
  const [rows, prodTargets, catTargets, usage] = await Promise.all([
    db
      .select()
      .from(promotions)
      .where(eq(promotions.organizationId, organizationId))
      .orderBy(desc(promotions.startAt)),
    db
      .select()
      .from(promotionProducts)
      .where(eq(promotionProducts.organizationId, organizationId)),
    db
      .select()
      .from(promotionCategories)
      .where(eq(promotionCategories.organizationId, organizationId)),
    db
      .select({ promotionId: orderPromotions.promotionId, n: count() })
      .from(orderPromotions)
      .innerJoin(orders, eq(orders.id, orderPromotions.orderId))
      .where(eq(orderPromotions.organizationId, organizationId))
      .groupBy(orderPromotions.promotionId),
  ]);
  const usageBy = new Map(usage.map((u) => [u.promotionId, u.n]));

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    discountType: p.discountType,
    discountValue: p.discountValue,
    minimumType: p.minimumType,
    minimumQuantity: p.minimumQuantity,
    minimumAmount: p.minimumAmount,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt.toISOString(),
    isActive: p.isActive,
    productIds: prodTargets
      .filter((t) => t.promotionId === p.id)
      .map((t) => t.productId),
    categoryIds: catTargets
      .filter((t) => t.promotionId === p.id)
      .map((t) => t.categoryId),
    state: promotionState(p),
    usageCount: usageBy.get(p.id) ?? 0,
  }));
}
