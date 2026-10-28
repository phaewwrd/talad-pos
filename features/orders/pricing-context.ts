import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  promotionCategories,
  promotionProducts,
  promotions,
  shopSettings,
} from "@/db/schema";
import type { Entitlements } from "@/lib/entitlements";
import type { CalculateOrderInput } from "@/lib/pricing/calculate-order";
import type { PromotionRule } from "@/lib/promotions/apply";

export type ShopPricing = {
  orderNumberPrefix: string;
  promptpayId: string | null;
  serviceCharge: CalculateOrderInput["serviceCharge"];
  vat: CalculateOrderInput["vat"];
};

export async function loadShopPricing(
  organizationId: string,
  conn: Tx | typeof db = db,
): Promise<ShopPricing> {
  const [s] = await conn
    .select()
    .from(shopSettings)
    .where(eq(shopSettings.organizationId, organizationId))
    .limit(1);
  return {
    orderNumberPrefix: s?.orderNumberPrefix ?? "TL",
    promptpayId: s?.promptpayId ?? null,
    serviceCharge: {
      enabled: s?.serviceChargeEnabled ?? false,
      rate: s?.serviceChargeRate ?? "0",
    },
    vat: {
      mode: s?.vatEnabled ? s.vatMode : "none",
      rate: s?.vatRate ?? "0",
    },
  };
}

/** Promotions live at `at` (or all active ones when omitted) with their targets. */
export async function loadPromotionRules(
  organizationId: string,
  entitlements: Entitlements,
  options: { at?: Date; conn?: Tx | typeof db } = {},
): Promise<PromotionRule[]> {
  if (!entitlements.features.promotions) return [];
  const conn = options.conn ?? db;
  const rows = await conn
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.organizationId, organizationId),
        eq(promotions.isActive, true),
        options.at ? lte(promotions.startAt, options.at) : undefined,
        options.at ? gte(promotions.endAt, options.at) : undefined,
      ),
    );
  if (rows.length === 0) return [];

  const [prodTargets, catTargets] = await Promise.all([
    conn
      .select()
      .from(promotionProducts)
      .where(eq(promotionProducts.organizationId, organizationId)),
    conn
      .select()
      .from(promotionCategories)
      .where(eq(promotionCategories.organizationId, organizationId)),
  ]);

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    discountType: p.discountType,
    discountValue: p.discountValue,
    minimumType: p.minimumType,
    minimumQuantity: p.minimumQuantity,
    minimumAmount: p.minimumAmount,
    startAt: p.startAt,
    endAt: p.endAt,
    isActive: p.isActive,
    productIds: prodTargets
      .filter((t) => t.promotionId === p.id)
      .map((t) => t.productId),
    categoryIds: catTargets
      .filter((t) => t.promotionId === p.id)
      .map((t) => t.categoryId),
  }));
}
