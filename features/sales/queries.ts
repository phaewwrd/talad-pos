import "server-only";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  type SQL,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import * as z from "zod";
import { db } from "@/db";
import {
  categories,
  member,
  orderItemLotAllocations,
  orderItems,
  orders,
  organization,
  productStockLots,
  products,
  user,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { money, sumMoney, toMoneyString } from "@/lib/money";
import type { MemberContext } from "@/lib/permissions";
import {
  bucketsFor,
  type DateRange,
  previousRange,
  resolveRange,
} from "@/lib/sales/range";
import { addDays } from "@/lib/time";

export const salesQuerySchema = z.object({
  preset: z.enum(["today", "7d", "month", "custom"]).default("7d"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  group: z.enum(["day", "week", "month"]).default("day"),
});
export type SalesQuery = z.infer<typeof salesQuerySchema>;

export function parseSalesQuery(params: URLSearchParams) {
  const r = salesQuerySchema.safeParse(Object.fromEntries(params));
  if (!r.success) throw new AppError("VALIDATION");
  return r.data;
}

const bangkokStart = (date: string) => new Date(`${date}T00:00:00+07:00`);

/** Sales-relevant orders: this shop, not deleted, not cancelled, in range. */
function baseWhere(
  organizationId: string,
  range: DateRange,
  onlyUserId?: string,
): SQL {
  return and(
    eq(orders.organizationId, organizationId),
    isNull(orders.deletedAt),
    ne(orders.status, "Cancelled"),
    gte(orders.createdAt, bangkokStart(range.from)),
    lt(orders.createdAt, addDays(bangkokStart(range.to), 1)),
    onlyUserId ? eq(orders.createdBy, onlyUserId) : undefined,
  ) as SQL;
}

const sumText = (col: SQL | AnyPgColumn) =>
  sql<string>`COALESCE(SUM(${col}), 0)::text`;

/** Cashiers only see today's own sales; everyone else sees what they ask for. */
export function effectiveScope(ctx: MemberContext, q: SalesQuery) {
  if (ctx.role === "cashier") {
    return {
      range: resolveRange("today", new Date()),
      group: "day" as const,
      onlyUserId: ctx.user.id,
    };
  }
  return {
    range: resolveRange(q.preset, new Date(), { from: q.from, to: q.to }),
    group: q.group,
    onlyUserId: undefined,
  };
}

async function series(where: SQL, group: "day" | "week" | "month") {
  const bucket = sql<string>`to_char(date_trunc(${sql.raw(`'${group}'`)}, ${orders.createdAt} AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM-DD')`;
  return db
    .select({
      bucket,
      revenue: sumText(orders.total),
      orders: sql<number>`COUNT(*)::int`,
    })
    .from(orders)
    .where(where)
    .groupBy(bucket);
}

export async function getSalesReport(ctx: MemberContext, q: SalesQuery) {
  const { range, group, onlyUserId } = effectiveScope(ctx, q);
  const prev = previousRange(range);
  const where = baseWhere(ctx.organizationId, range, onlyUserId);
  const prevWhere = baseWhere(ctx.organizationId, prev, onlyUserId);
  const isOwner = ctx.role === "owner";

  const [
    kpi,
    prevKpi,
    cur,
    before,
    byChannel,
    byMethod,
    byStaff,
    topProducts,
    topCategories,
  ] = await Promise.all([
    db
      .select({
        revenue: sumText(orders.total),
        orders: sql<number>`COUNT(*)::int`,
        discounts: sumText(orders.discountTotal),
        vat: sumText(orders.vatAmount),
      })
      .from(orders)
      .where(where),
    db
      .select({
        revenue: sumText(orders.total),
        orders: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(prevWhere),
    series(where, group),
    series(prevWhere, group),
    db
      .select({
        key: orders.salesChannel,
        revenue: sumText(orders.total),
        orders: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(where)
      .groupBy(orders.salesChannel),
    db
      .select({
        key: sql<string>`COALESCE(${orders.paymentMethod}, 'unpaid')`,
        revenue: sumText(orders.total),
        orders: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(where)
      .groupBy(sql`COALESCE(${orders.paymentMethod}, 'unpaid')`),
    db
      .select({
        key: sql<string>`COALESCE(${user.name}, '—')`,
        revenue: sumText(orders.total),
        orders: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .leftJoin(user, eq(user.id, orders.createdBy))
      .where(where)
      .groupBy(sql`COALESCE(${user.name}, '—')`),
    db
      .select({
        key: orderItems.productName,
        quantity: sql<number>`SUM(${orderItems.quantity})::int`,
        revenue: sumText(orderItems.lineTotal),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(where)
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`SUM(${orderItems.lineTotal})`))
      .limit(10),
    db
      .select({
        key: categories.name,
        quantity: sql<number>`SUM(${orderItems.quantity})::int`,
        revenue: sumText(orderItems.lineTotal),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .groupBy(categories.name)
      .orderBy(desc(sql`SUM(${orderItems.lineTotal})`))
      .limit(10),
  ]);

  // Real COGS from FIFO allocations — owner only.
  let profit: { cogs: string; netSales: string; grossProfit: string } | null =
    null;
  if (isOwner) {
    const [row] = await db
      .select({
        cogs: sql<string>`COALESCE(SUM(${orderItemLotAllocations.quantity} * ${productStockLots.cost}), 0)::text`,
      })
      .from(orderItemLotAllocations)
      .innerJoin(
        productStockLots,
        eq(productStockLots.id, orderItemLotAllocations.lotId),
      )
      .innerJoin(
        orderItems,
        eq(orderItems.id, orderItemLotAllocations.orderItemId),
      )
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(where);
    // TODO(decision): gross profit = revenue excluding VAT − FIFO COGS.
    const netSales = money(kpi[0].revenue).minus(kpi[0].vat);
    profit = {
      cogs: toMoneyString(row.cogs),
      netSales: toMoneyString(netSales),
      grossProfit: toMoneyString(netSales.minus(row.cogs)),
    };
  }

  const curBy = new Map(cur.map((r) => [r.bucket, r]));
  const prevBy = new Map(before.map((r) => [r.bucket, r]));
  const curKeys = bucketsFor(range, group);
  const prevKeys = bucketsFor(prev, group);
  const chart = curKeys.map((key, i) => ({
    bucket: key,
    previousBucket: prevKeys[i] ?? null,
    revenue: curBy.get(key)?.revenue ?? "0",
    orders: curBy.get(key)?.orders ?? 0,
    previousRevenue: prevKeys[i]
      ? (prevBy.get(prevKeys[i])?.revenue ?? "0")
      : null,
  }));

  const { revenue, orders: orderCount, discounts } = kpi[0];
  return {
    range,
    previousRange: prev,
    group,
    scope: onlyUserId ? ("own-today" as const) : ("shop" as const),
    kpis: {
      revenue,
      orders: orderCount,
      averageOrderValue: orderCount
        ? toMoneyString(money(revenue).dividedBy(orderCount))
        : "0.00",
      discounts,
      previousRevenue: prevKpi[0].revenue,
      previousOrders: prevKpi[0].orders,
    },
    profit,
    chart,
    breakdowns: { channel: byChannel, paymentMethod: byMethod, staff: byStaff },
    topProducts,
    topCategories,
  };
}
export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;

/** Owner-only: revenue across every shop they own, same range. */
export async function getAllShopsSummary(ctx: MemberContext, q: SalesQuery) {
  if (ctx.role !== "owner") throw new AppError("FORBIDDEN");
  const range = resolveRange(q.preset, new Date(), { from: q.from, to: q.to });
  const shops = await db
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, ctx.user.id), eq(member.role, "owner")));
  if (shops.length === 0) return { range, shops: [], total: "0.00" };
  const rows = await db
    .select({
      id: orders.organizationId,
      revenue: sumText(orders.total),
      orders: sql<number>`COUNT(*)::int`,
    })
    .from(orders)
    .where(
      and(
        inArray(
          orders.organizationId,
          shops.map((s) => s.id),
        ),
        isNull(orders.deletedAt),
        ne(orders.status, "Cancelled"),
        gte(orders.createdAt, bangkokStart(range.from)),
        lt(orders.createdAt, addDays(bangkokStart(range.to), 1)),
      ),
    )
    .groupBy(orders.organizationId);
  const by = new Map(rows.map((r) => [r.id, r]));
  const list = shops.map((s) => ({
    ...s,
    revenue: by.get(s.id)?.revenue ?? "0",
    orders: by.get(s.id)?.orders ?? 0,
  }));
  return {
    range,
    shops: list,
    total: toMoneyString(sumMoney(list.map((s) => s.revenue))),
  };
}

/** Rows for CSV/XLSX export. */
export async function getSalesExportRows(ctx: MemberContext, q: SalesQuery) {
  const { range, onlyUserId } = effectiveScope(ctx, q);
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      channel: orders.salesChannel,
      customer: orders.customerName,
      status: orders.status,
      paymentType: orders.paymentType,
      paymentMethod: orders.paymentMethod,
      subtotal: orders.subtotal,
      discount: orders.discountTotal,
      serviceCharge: orders.serviceChargeAmount,
      vat: orders.vatAmount,
      total: orders.total,
      staff: user.name,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.createdBy))
    .where(baseWhere(ctx.organizationId, range, onlyUserId))
    .orderBy(orders.createdAt);
  return { range, rows };
}
