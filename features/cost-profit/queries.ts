import "server-only";
import { and, desc, eq, gte, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  costProfitEntries,
  orderItemLotAllocations,
  orderItems,
  orders,
  productStockLots,
} from "@/db/schema";
import { entryProfit, marginPercent } from "@/lib/cost-profit";
import { money, toMoneyString } from "@/lib/money";
import type { DateRange } from "@/lib/sales/range";
import { addDays } from "@/lib/time";

const bangkokStart = (date: string) => new Date(`${date}T00:00:00+07:00`);

/** Per product × channel from real orders: revenue, FIFO COGS, gross profit, margin. */
export async function getRealOrdersProfit(
  organizationId: string,
  range: DateRange,
) {
  const where = and(
    eq(orders.organizationId, organizationId),
    isNull(orders.deletedAt),
    ne(orders.status, "Cancelled"),
    gte(orders.createdAt, bangkokStart(range.from)),
    lt(orders.createdAt, addDays(bangkokStart(range.to), 1)),
  );
  const [sales, cogs] = await Promise.all([
    db
      .select({
        productId: orderItems.productId,
        productName: orderItems.productName,
        channel: orders.salesChannel,
        quantity: sql<number>`SUM(${orderItems.quantity})::int`,
        revenue: sql<string>`SUM(${orderItems.lineTotal})::text`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(where)
      .groupBy(
        orderItems.productId,
        orderItems.productName,
        orders.salesChannel,
      ),
    db
      .select({
        productId: orderItems.productId,
        channel: orders.salesChannel,
        cogs: sql<string>`SUM(${orderItemLotAllocations.quantity} * ${productStockLots.cost})::text`,
      })
      .from(orderItemLotAllocations)
      .innerJoin(
        orderItems,
        eq(orderItems.id, orderItemLotAllocations.orderItemId),
      )
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(
        productStockLots,
        eq(productStockLots.id, orderItemLotAllocations.lotId),
      )
      .where(where)
      .groupBy(orderItems.productId, orders.salesChannel),
  ]);
  const cogsBy = new Map(
    cogs.map((c) => [`${c.productId}:${c.channel}`, c.cogs]),
  );
  return sales
    .map((s) => {
      // Line totals are pre-VAT/service; profit here is per product line.
      const c = cogsBy.get(`${s.productId}:${s.channel}`) ?? "0";
      const profit = toMoneyString(money(s.revenue).minus(c));
      return {
        ...s,
        cogs: toMoneyString(c),
        grossProfit: profit,
        marginPercent: marginPercent(s.revenue, profit),
      };
    })
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));
}

export async function listEntries(organizationId: string, range: DateRange) {
  const rows = await db
    .select()
    .from(costProfitEntries)
    .where(
      and(
        eq(costProfitEntries.organizationId, organizationId),
        gte(costProfitEntries.entryDate, range.from),
        lte(costProfitEntries.entryDate, range.to),
      ),
    )
    .orderBy(
      desc(costProfitEntries.entryDate),
      desc(costProfitEntries.createdAt),
    );
  return rows.map((r) => ({
    id: r.id,
    entryDate: r.entryDate,
    salesChannel: r.salesChannel,
    productId: r.productId,
    productName: r.productName,
    quantity: r.quantity,
    unitCost: r.unitCost,
    unitPrice: r.unitPrice,
    platformFeeRate: r.platformFeeRate,
    ...entryProfit(r),
  }));
}
export type EntryDTO = Awaited<ReturnType<typeof listEntries>>[number];
export type RealProfitDTO = Awaited<
  ReturnType<typeof getRealOrdersProfit>
>[number];
