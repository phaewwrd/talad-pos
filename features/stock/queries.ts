import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  productStockLots,
  products,
  shopSettings,
  stockAdjustments,
  user,
} from "@/db/schema";
import { canSeeCost } from "@/features/catalog/queries";
import type { MemberContext } from "@/lib/permissions";
import { addDays, bangkokDateString } from "@/lib/time";
import type {
  StockMovementDTO,
  StockOverviewDTO,
  StockProductDTO,
} from "./types";

async function expiryAlertDays(organizationId: string) {
  const [row] = await db
    .select({ days: shopSettings.expiryAlertDays })
    .from(shopSettings)
    .where(eq(shopSettings.organizationId, organizationId))
    .limit(1);
  return row?.days ?? 7;
}

export async function getStock(
  ctx: Pick<MemberContext, "organizationId" | "role">,
): Promise<{ overview: StockOverviewDTO; products: StockProductDTO[] }> {
  const alertDays = await expiryAlertDays(ctx.organizationId);
  const today = bangkokDateString(new Date());
  const alertBy = bangkokDateString(addDays(new Date(), alertDays));
  const showCost = canSeeCost(ctx);

  const [productRows, lotRows] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        imageUrl: products.imageUrl,
        categoryName: categories.name,
        stockQuantity: products.stockQuantity,
        minimumStock: products.minimumStock,
        isActive: products.isActive,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(eq(products.organizationId, ctx.organizationId))
      .orderBy(asc(categories.orderNo), asc(products.name)),
    db
      .select()
      .from(productStockLots)
      .where(eq(productStockLots.organizationId, ctx.organizationId))
      .orderBy(
        asc(productStockLots.stockInDate),
        asc(productStockLots.createdAt),
      ),
  ]);

  const lotsByProduct = new Map<string, StockProductDTO["lots"]>();
  let expiringSoon = 0;
  for (const lot of lotRows) {
    const expired = lot.expiryDate !== null && lot.expiryDate < today;
    const soon =
      lot.expiryDate !== null &&
      !expired &&
      lot.expiryDate <= alertBy &&
      lot.remainingQuantity > 0;
    if ((soon || expired) && lot.remainingQuantity > 0) expiringSoon++;
    const list = lotsByProduct.get(lot.productId) ?? [];
    list.push({
      id: lot.id,
      lotNumber: lot.lotNumber,
      stockInDate: lot.stockInDate,
      expiryDate: lot.expiryDate,
      initialQuantity: lot.initialQuantity,
      remainingQuantity: lot.remainingQuantity,
      ...(showCost ? { cost: lot.cost } : {}),
      expiringSoon: soon,
      expired: expired && lot.remainingQuantity > 0,
    });
    lotsByProduct.set(lot.productId, list);
  }

  const list = productRows.map((p) => ({
    ...p,
    lots: lotsByProduct.get(p.id) ?? [],
  }));
  return {
    overview: {
      totalSkus: list.length,
      lowStock: list.filter(
        (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minimumStock,
      ).length,
      outOfStock: list.filter((p) => p.stockQuantity === 0).length,
      expiringSoon,
      expiryAlertDays: alertDays,
    },
    products: list,
  };
}

export async function listStockMovements(
  organizationId: string,
  limit = 200,
): Promise<StockMovementDTO[]> {
  const rows = await db
    .select({
      id: stockAdjustments.id,
      createdAt: stockAdjustments.createdAt,
      productName: products.name,
      lotNumber: productStockLots.lotNumber,
      type: stockAdjustments.type,
      quantity: stockAdjustments.quantity,
      reason: stockAdjustments.reason,
      actorName: user.name,
    })
    .from(stockAdjustments)
    .innerJoin(products, eq(products.id, stockAdjustments.productId))
    .leftJoin(productStockLots, eq(productStockLots.id, stockAdjustments.lotId))
    .leftJoin(user, eq(user.id, stockAdjustments.actorId))
    .where(and(eq(stockAdjustments.organizationId, organizationId)))
    .orderBy(desc(stockAdjustments.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Next suggested lot number for a product: L{YYYYMMDD}-{n}. */
export async function suggestLotNumber(
  organizationId: string,
  productId: string,
) {
  const day = bangkokDateString(new Date()).replaceAll("-", "");
  const lots = await db
    .select({ lotNumber: productStockLots.lotNumber })
    .from(productStockLots)
    .where(
      and(
        eq(productStockLots.organizationId, organizationId),
        eq(productStockLots.productId, productId),
      ),
    );
  const used = new Set(lots.map((l) => l.lotNumber));
  let n = 1;
  while (used.has(`L${day}-${n}`)) n++;
  return `L${day}-${n}`;
}
