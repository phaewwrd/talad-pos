import "server-only";
import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  orderAuditLogs,
  orderItemLotAllocations,
  orderItems,
  orderPromotions,
  orders,
  productStockLots,
  products,
  user,
} from "@/db/schema";
import { listCategories, listProducts } from "@/features/catalog/queries";
import { AppError } from "@/lib/errors";
import {
  formatOrderNumber,
  orderDateKey,
  parseOrderSeq,
} from "@/lib/orders/order-number";
import { ACTIVE_STATUSES } from "@/lib/orders/status";
import type { MemberContext } from "@/lib/permissions";
import { addDays } from "@/lib/time";
import { loadPromotionRules, loadShopPricing } from "./pricing-context";
import type { OrderFilters } from "./schemas";
import type {
  OrderDetailDTO,
  OrderListItemDTO,
  PosBootstrapDTO,
} from "./types";

const bangkokStart = (date: string) => new Date(`${date}T00:00:00+07:00`);

function listSelect() {
  return {
    id: orders.id,
    orderNumber: orders.orderNumber,
    createdAt: orders.createdAt,
    customerName: orders.customerName,
    total: orders.total,
    status: orders.status,
    paymentType: orders.paymentType,
    paymentMethod: orders.paymentMethod,
    salesChannel: orders.salesChannel,
    staffId: orders.createdBy,
    staffName: user.name,
    deletedAt: orders.deletedAt,
    deleteReason: orders.deleteReason,
  };
}

async function withItemCounts(
  rows: (Omit<OrderListItemDTO, "itemCount" | "createdAt" | "deletedAt"> & {
    createdAt: Date;
    deletedAt: Date | null;
  })[],
): Promise<OrderListItemDTO[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({ orderId: orderItems.orderId, n: count() })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(orderItems.orderId);
  const byOrder = new Map(counts.map((c) => [c.orderId, c.n]));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
    itemCount: byOrder.get(r.id) ?? 0,
  }));
}

export async function listOrders(
  ctx: MemberContext,
  filters: OrderFilters,
  limit = 500,
) {
  const conditions: (SQL | undefined)[] = [
    eq(orders.organizationId, ctx.organizationId),
  ];
  // Only owners can see deleted orders.
  if (filters.deleted === "1") {
    if (ctx.role !== "owner") throw new AppError("FORBIDDEN");
    conditions.push(isNotNull(orders.deletedAt));
  } else {
    conditions.push(isNull(orders.deletedAt));
  }
  if (filters.from)
    conditions.push(gte(orders.createdAt, bangkokStart(filters.from)));
  if (filters.to)
    conditions.push(lt(orders.createdAt, addDays(bangkokStart(filters.to), 1)));
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.channel)
    conditions.push(eq(orders.salesChannel, filters.channel));
  if (filters.paymentType)
    conditions.push(eq(orders.paymentType, filters.paymentType));
  if (filters.paymentMethod)
    conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
  if (filters.staffId) conditions.push(eq(orders.createdBy, filters.staffId));
  if (filters.active === "1")
    conditions.push(inArray(orders.status, [...ACTIVE_STATUSES]));
  if (filters.q) {
    const q = `%${filters.q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(ilike(orders.orderNumber, q), ilike(orders.customerName, q)),
    );
  }

  const rows = await db
    .select(listSelect())
    .from(orders)
    .leftJoin(user, eq(user.id, orders.createdBy))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return withItemCounts(rows);
}

export async function getOrderDetail(
  ctx: MemberContext,
  orderId: string,
): Promise<OrderDetailDTO> {
  const deletedBy = aliasedTable(user, "deleted_by_user");
  const [order] = await db
    .select({
      ...listSelect(),
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      serviceChargeRate: orders.serviceChargeRate,
      serviceChargeAmount: orders.serviceChargeAmount,
      vatMode: orders.vatMode,
      vatRate: orders.vatRate,
      vatAmount: orders.vatAmount,
      cashReceived: orders.cashReceived,
      changeAmount: orders.changeAmount,
      paidAt: orders.paidAt,
      deletedByName: deletedBy.name,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.createdBy))
    .leftJoin(deletedBy, eq(deletedBy.id, orders.deletedBy))
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.organizationId, ctx.organizationId),
      ),
    )
    .limit(1);
  if (!order || (order.deletedAt && ctx.role !== "owner"))
    throw new AppError("NOT_FOUND");

  const showLots = ctx.role !== "cashier";
  const showCost = ctx.role === "owner";

  const [items, promos, auditRows] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        productName: orderItems.productName,
        categoryId: products.categoryId,
        imageUrl: products.imageUrl,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        discountAmount: orderItems.discountAmount,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.productName)),
    db
      .select({
        promotionId: orderPromotions.promotionId,
        promotionName: orderPromotions.promotionName,
        discountAmount: orderPromotions.discountAmount,
        matchedQuantity: orderPromotions.matchedQuantity,
      })
      .from(orderPromotions)
      .where(eq(orderPromotions.orderId, order.id)),
    db
      .select({
        id: orderAuditLogs.id,
        action: orderAuditLogs.action,
        actorName: user.name,
        reason: orderAuditLogs.reason,
        createdAt: orderAuditLogs.createdAt,
        before: orderAuditLogs.before,
        after: orderAuditLogs.after,
      })
      .from(orderAuditLogs)
      .leftJoin(user, eq(user.id, orderAuditLogs.actorId))
      .where(eq(orderAuditLogs.orderId, order.id))
      .orderBy(asc(orderAuditLogs.createdAt)),
  ]);

  const allocations =
    showLots && items.length
      ? await db
          .select({
            orderItemId: orderItemLotAllocations.orderItemId,
            lotNumber: productStockLots.lotNumber,
            quantity: orderItemLotAllocations.quantity,
            cost: productStockLots.cost,
          })
          .from(orderItemLotAllocations)
          .innerJoin(
            productStockLots,
            eq(productStockLots.id, orderItemLotAllocations.lotId),
          )
          .where(
            inArray(
              orderItemLotAllocations.orderItemId,
              items.map((i) => i.id),
            ),
          )
      : [];

  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    deletedAt: order.deletedAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    itemCount: items.length,
    items: items.map((i) => ({
      ...i,
      ...(showLots
        ? {
            allocations: allocations
              .filter((a) => a.orderItemId === i.id)
              .map((a) => ({
                lotNumber: a.lotNumber,
                quantity: a.quantity,
                ...(showCost ? { cost: a.cost } : {}),
              })),
          }
        : {}),
    })),
    promotions: promos,
    // Audit snapshots may include cost-free data only; hide them from cashiers anyway.
    audit: auditRows.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      before: showLots ? a.before : null,
      after: showLots ? a.after : null,
    })),
  };
}

export async function getPosBootstrap(
  ctx: MemberContext,
): Promise<PosBootstrapDTO> {
  const now = new Date();
  const [productList, categoryList, pricing, rules] = await Promise.all([
    listProducts(ctx, { activeOnly: true }),
    listCategories(ctx.organizationId),
    loadShopPricing(ctx.organizationId),
    loadPromotionRules(ctx.organizationId, ctx.entitlements, { at: now }),
  ]);

  const dayKey = orderDateKey(now);
  const [last] = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, ctx.organizationId),
        like(orders.orderNumber, `${pricing.orderNumberPrefix}-${dayKey}-%`),
      ),
    )
    .orderBy(desc(orders.orderNumber))
    .limit(1);

  return {
    // The POS never needs cost.
    products: productList.map(({ cost: _cost, ...p }) => p),
    categories: categoryList,
    promotions: rules.map((r) => ({
      ...r,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      productIds: [...r.productIds],
      categoryIds: [...r.categoryIds],
    })),
    pricing,
    nextOrderNumber: formatOrderNumber(
      pricing.orderNumberPrefix,
      now,
      (last ? parseOrderSeq(last.orderNumber) : 0) + 1,
    ),
    platformChannels: ctx.entitlements.features.platformChannels,
  };
}
