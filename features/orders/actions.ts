"use server";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  sql,
} from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  type OrderAuditAction,
  orderAuditLogs,
  orderItemLotAllocations,
  orderItems,
  orderPromotions,
  orders,
  products,
} from "@/db/schema";
import { AppError, runAction } from "@/lib/errors";
import { money, toMoneyString } from "@/lib/money";
import {
  formatOrderNumber,
  orderDateKey,
  parseOrderSeq,
} from "@/lib/orders/order-number";
import { classifyTransition } from "@/lib/orders/status";
import { type MemberContext, requireMember } from "@/lib/permissions";
import {
  type CalculatedOrder,
  calculateOrder,
} from "@/lib/pricing/calculate-order";
import {
  allocateForItem,
  loadAllocations,
  returnToLots,
  syncProductStock,
} from "@/lib/stock/db";
import { releaseAllocations } from "@/lib/stock/fifo";
import { stockChanged } from "@/lib/stock/version";
import { loadPromotionRules, loadShopPricing } from "./pricing-context";
import {
  changeStatusSchema,
  createOrderSchema,
  type PaymentInput,
  reasonSchema,
  takePaymentSchema,
  updateOrderSchema,
} from "./schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse<T>(
  schema: {
    safeParse: (v: unknown) => { success: true; data: T } | { success: false };
  },
  raw: unknown,
): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError("VALIDATION");
  return r.data;
}

function mergeItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const i of items)
    merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

function assertChannel(ctx: MemberContext, channel: string) {
  if (channel !== "storefront" && !ctx.entitlements.features.platformChannels) {
    throw new AppError("FEATURE_DISABLED", { feature: "platformChannels" });
  }
}

/** Lock products (sorted by id to avoid deadlocks) and return them by id. */
async function lockProducts(tx: Tx, organizationId: string, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  if (sorted.length === 0) return new Map();
  const rows = await tx
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      categoryId: products.categoryId,
      isActive: products.isActive,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        inArray(products.id, sorted),
      ),
    )
    .orderBy(asc(products.id))
    .for("update");
  return new Map(rows.map((r) => [r.id, r]));
}

/** Next `{prefix}-{YYMMDD}-{seq}` for the shop, serialized per shop+day. */
async function nextOrderNumber(
  tx: Tx,
  organizationId: string,
  prefix: string,
  now: Date,
) {
  const dayKey = orderDateKey(now);
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`order-number:${organizationId}:${dayKey}`}))`,
  );
  const [last] = await tx
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        like(orders.orderNumber, `${prefix}-${dayKey}-%`),
      ),
    )
    .orderBy(desc(orders.orderNumber))
    .limit(1);
  return formatOrderNumber(
    prefix,
    now,
    (last ? parseOrderSeq(last.orderNumber) : 0) + 1,
  );
}

function paymentFields(
  payment: PaymentInput | undefined,
  total: string,
  now: Date,
) {
  if (!payment) {
    return {
      paymentType: "Unpaid" as const,
      paymentMethod: null,
      cashReceived: null,
      changeAmount: null,
      paidAt: null,
    };
  }
  if (payment.method === "cash") {
    const received = money(payment.cashReceived);
    if (received.lessThan(total))
      throw new AppError("VALIDATION", { field: "cashReceived" });
    return {
      paymentType: "Paid" as const,
      paymentMethod: "cash" as const,
      cashReceived: toMoneyString(received),
      changeAmount: toMoneyString(received.minus(total)),
      paidAt: now,
    };
  }
  return {
    paymentType: "Paid" as const,
    paymentMethod: "promptpay" as const,
    cashReceived: null,
    changeAmount: null,
    paidAt: now,
  };
}

type LockedOrder = typeof orders.$inferSelect;

async function lockOrder(
  tx: Tx,
  organizationId: string,
  orderId: string,
  options: { deleted?: boolean } = {},
): Promise<LockedOrder> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.organizationId, organizationId),
        options.deleted
          ? isNotNull(orders.deletedAt)
          : isNull(orders.deletedAt),
      ),
    )
    .for("update");
  if (!order) throw new AppError("NOT_FOUND");
  return order;
}

/** JSON snapshot for audit logs (before/after). */
async function snapshot(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  const items = await tx
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      discountAmount: orderItems.discountAmount,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const allocations = await loadAllocations(
    tx,
    items.map((i) => i.id),
  );
  return {
    status: order.status,
    paymentType: order.paymentType,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    salesChannel: order.salesChannel,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    serviceChargeAmount: order.serviceChargeAmount,
    vatAmount: order.vatAmount,
    total: order.total,
    items: items.map((i) => ({
      ...i,
      allocations: allocations
        .filter((a) => a.orderItemId === i.id)
        .map((a) => ({ lotId: a.lotId, quantity: a.quantity })),
    })),
  };
}

async function audit(
  tx: Tx,
  entry: {
    organizationId: string;
    orderId: string;
    action: OrderAuditAction;
    actorId: string;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.insert(orderAuditLogs).values({
    organizationId: entry.organizationId,
    orderId: entry.orderId,
    action: entry.action,
    actorId: entry.actorId,
    reason: entry.reason ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

/** Return every allocated unit of an order to its lots and drop the allocations. */
async function releaseOrderStock(tx: Tx, orderId: string) {
  const items = await tx
    .select({ id: orderItems.id, productId: orderItems.productId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const allocations = await loadAllocations(
    tx,
    items.map((i) => i.id),
  );
  await returnToLots(tx, allocations);
  if (allocations.length) {
    await tx.delete(orderItemLotAllocations).where(
      inArray(
        orderItemLotAllocations.id,
        allocations.map((a) => a.id),
      ),
    );
  }
  await syncProductStock(
    tx,
    items.map((i) => i.productId),
  );
}

async function writePromotions(
  tx: Tx,
  organizationId: string,
  orderId: string,
  calc: CalculatedOrder,
) {
  await tx.delete(orderPromotions).where(eq(orderPromotions.orderId, orderId));
  if (calc.promotions.length === 0) return;
  await tx.insert(orderPromotions).values(
    calc.promotions.map((p) => ({
      organizationId,
      orderId,
      promotionId: p.promotionId,
      promotionName: p.promotionName,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minimumType: p.minimumType,
      minimumQuantity: p.minimumQuantity,
      minimumAmount: p.minimumAmount,
      matchedQuantity: p.matchedQuantity,
      discountAmount: p.discountAmount,
    })),
  );
}

function totalsFields(calc: CalculatedOrder) {
  return {
    subtotal: calc.subtotal,
    discountTotal: calc.discountTotal,
    serviceChargeRate: calc.serviceChargeRate,
    serviceChargeAmount: calc.serviceChargeAmount,
    vatMode: calc.vatMode,
    vatRate: calc.vatRate,
    vatAmount: calc.vatAmount,
    total: calc.total,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create an order. The server recomputes every price, promotion and tax from
 * the DB (client totals are ignored), allocates stock FIFO under row locks and
 * writes everything in one transaction — no partial orders.
 */
export async function createOrder(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember();
    const input = parse(createOrderSchema, raw);
    assertChannel(ctx, input.salesChannel);
    const items = mergeItems(input.items);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const productMap = await lockProducts(
        tx,
        ctx.organizationId,
        items.map((i) => i.productId),
      );
      const lines = items.map((i) => {
        const p = productMap.get(i.productId);
        if (!p || !p.isActive) throw new AppError("NOT_FOUND");
        return {
          productId: p.id,
          categoryId: p.categoryId,
          productName: p.name,
          unitPrice: p.price,
          quantity: i.quantity,
        };
      });

      const pricing = await loadShopPricing(ctx.organizationId, tx);
      const promotions = await loadPromotionRules(
        ctx.organizationId,
        ctx.entitlements,
        {
          at: now,
          conn: tx,
        },
      );
      const calc = calculateOrder({
        lines,
        promotions,
        excludedPromotionIds: input.excludedPromotionIds,
        serviceCharge: pricing.serviceCharge,
        vat: pricing.vat,
        now,
      });
      const payment = paymentFields(input.payment, calc.total, now);
      const orderNumber = await nextOrderNumber(
        tx,
        ctx.organizationId,
        pricing.orderNumberPrefix,
        now,
      );

      const [order] = await tx
        .insert(orders)
        .values({
          organizationId: ctx.organizationId,
          orderNumber,
          customerName: input.customerName || "Walk-in",
          salesChannel: input.salesChannel,
          status: "Pending",
          ...totalsFields(calc),
          ...payment,
          createdBy: ctx.user.id,
          createdAt: now,
        })
        .returning({ id: orders.id });

      for (const line of calc.lines) {
        const [item] = await tx
          .insert(orderItems)
          .values({
            organizationId: ctx.organizationId,
            orderId: order.id,
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
          })
          .returning({ id: orderItems.id });
        await allocateForItem(tx, {
          organizationId: ctx.organizationId,
          orderItemId: item.id,
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
        });
      }
      await writePromotions(tx, ctx.organizationId, order.id, calc);
      await syncProductStock(
        tx,
        items.map((i) => i.productId),
      );
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "create",
        actorId: ctx.user.id,
        after: await snapshot(tx, order.id),
      });

      return {
        id: order.id,
        orderNumber,
        total: calc.total,
        paymentType: payment.paymentType,
        changeAmount: payment.changeAmount,
      };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

function assertCanEdit(
  ctx: MemberContext,
  order: LockedOrder,
  reason: string | undefined,
) {
  if (order.status === "Cancelled") throw new AppError("ORDER_LOCKED");
  const locked = order.paymentType === "Paid" || order.status !== "Pending";
  if (ctx.role === "cashier") {
    // Cashiers may edit only their own unpaid, pending orders.
    if (order.createdBy !== ctx.user.id || locked)
      throw new AppError("FORBIDDEN");
  } else if (ctx.role === "manager" && locked && !reason) {
    throw new AppError("REASON_REQUIRED");
  }
}

/** Edit items/customer/channel: recompute totals + promotions, re-balance stock. */
export async function updateOrder(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember();
    const input = parse(updateOrderSchema, raw);
    assertChannel(ctx, input.salesChannel);
    const items = mergeItems(input.items);

    const result = await db.transaction(async (tx) => {
      const order = await lockOrder(tx, ctx.organizationId, input.orderId);
      assertCanEdit(ctx, order, input.reason);
      const before = await snapshot(tx, order.id);

      const existing = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      const existingByProduct = new Map(existing.map((i) => [i.productId, i]));
      const productMap = await lockProducts(tx, ctx.organizationId, [
        ...existing.map((i) => i.productId),
        ...items.map((i) => i.productId),
      ]);

      // Existing lines keep their snapshot price; new lines use today's price.
      const lines = items.map((i) => {
        const p = productMap.get(i.productId);
        const prev = existingByProduct.get(i.productId);
        if (!p || (!prev && !p.isActive)) throw new AppError("NOT_FOUND");
        return {
          productId: p.id,
          categoryId: p.categoryId,
          productName: prev?.productName ?? p.name,
          unitPrice: prev?.unitPrice ?? p.price,
          quantity: i.quantity,
        };
      });

      // TODO(decision): promotions are re-evaluated as of the order's creation
      // time; service charge and VAT keep the rates snapshotted on the order.
      const promotions = await loadPromotionRules(
        ctx.organizationId,
        ctx.entitlements,
        {
          at: order.createdAt,
          conn: tx,
        },
      );
      const calc = calculateOrder({
        lines,
        promotions,
        excludedPromotionIds: input.excludedPromotionIds,
        serviceCharge: {
          enabled: money(order.serviceChargeRate).greaterThan(0),
          rate: order.serviceChargeRate,
        },
        vat: { mode: order.vatMode, rate: order.vatRate },
        now: order.createdAt,
      });

      const allocations = await loadAllocations(
        tx,
        existing.map((i) => i.id),
      );
      const keepIds = new Set(calc.lines.map((l) => l.productId));

      // Removed lines: return all stock, delete the item.
      for (const item of existing.filter((i) => !keepIds.has(i.productId))) {
        const mine = allocations.filter((a) => a.orderItemId === item.id);
        await returnToLots(tx, mine);
        await tx.delete(orderItems).where(eq(orderItems.id, item.id)); // cascades allocations
      }

      for (const line of calc.lines) {
        const prev = existingByProduct.get(line.productId);
        if (!prev) {
          const [item] = await tx
            .insert(orderItems)
            .values({
              organizationId: ctx.organizationId,
              orderId: order.id,
              productId: line.productId,
              productName: line.productName,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
            })
            .returning({ id: orderItems.id });
          await allocateForItem(tx, {
            organizationId: ctx.organizationId,
            orderItemId: item.id,
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
          });
          continue;
        }

        const diff = line.quantity - prev.quantity;
        if (diff > 0) {
          await allocateForItem(tx, {
            organizationId: ctx.organizationId,
            orderItemId: prev.id,
            productId: line.productId,
            productName: line.productName,
            quantity: diff,
          });
        } else if (diff < 0) {
          const mine = allocations.filter((a) => a.orderItemId === prev.id);
          const { released, kept } = releaseAllocations(mine, -diff);
          await returnToLots(tx, released);
          await tx
            .delete(orderItemLotAllocations)
            .where(eq(orderItemLotAllocations.orderItemId, prev.id));
          if (kept.length) {
            await tx.insert(orderItemLotAllocations).values(
              kept.map((a) => ({
                organizationId: ctx.organizationId,
                orderItemId: prev.id,
                lotId: a.lotId,
                quantity: a.quantity,
              })),
            );
          }
        }
        await tx
          .update(orderItems)
          .set({
            quantity: line.quantity,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
          })
          .where(eq(orderItems.id, prev.id));
      }

      await writePromotions(tx, ctx.organizationId, order.id, calc);

      let changeAmount = order.changeAmount;
      if (
        order.paymentType === "Paid" &&
        order.paymentMethod === "cash" &&
        order.cashReceived
      ) {
        const change = money(order.cashReceived).minus(calc.total);
        if (change.isNegative())
          throw new AppError("VALIDATION", { field: "cashReceived" });
        changeAmount = toMoneyString(change);
      }
      await tx
        .update(orders)
        .set({
          ...totalsFields(calc),
          customerName: input.customerName || "Walk-in",
          salesChannel: input.salesChannel,
          changeAmount,
        })
        .where(eq(orders.id, order.id));
      await syncProductStock(tx, [
        ...existing.map((i) => i.productId),
        ...items.map((i) => i.productId),
      ]);
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "update",
        actorId: ctx.user.id,
        reason: input.reason,
        before,
        after: await snapshot(tx, order.id),
      });
      return { id: order.id, total: calc.total };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}

// ---------------------------------------------------------------------------
// Status, payment, delete, restore
// ---------------------------------------------------------------------------

export async function changeOrderStatus(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember();
    const input = parse(changeStatusSchema, raw);

    const result = await db.transaction(async (tx) => {
      const order = await lockOrder(tx, ctx.organizationId, input.orderId);
      const kind = classifyTransition(order.status, input.status);
      if (kind === "none") return { id: order.id, status: order.status };
      if (kind === "invalid") throw new AppError("INVALID_STATUS_TRANSITION");
      if (kind === "backward" || kind === "cancel") {
        if (ctx.role === "cashier") throw new AppError("FORBIDDEN");
        if (!input.reason && (kind === "cancel" || ctx.role === "manager")) {
          throw new AppError("REASON_REQUIRED");
        }
      }
      if (kind === "cancel") await releaseOrderStock(tx, order.id);

      await tx
        .update(orders)
        .set({ status: input.status })
        .where(eq(orders.id, order.id));
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "status_change",
        actorId: ctx.user.id,
        reason: input.reason,
        before: { status: order.status },
        after: { status: input.status },
      });
      return { id: order.id, status: input.status };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}

export async function takePayment(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember();
    const input = parse(takePaymentSchema, raw);

    return db.transaction(async (tx) => {
      const order = await lockOrder(tx, ctx.organizationId, input.orderId);
      if (order.paymentType === "Paid" || order.status === "Cancelled") {
        throw new AppError("ORDER_LOCKED");
      }
      const payment = paymentFields(input.payment, order.total, new Date());
      await tx.update(orders).set(payment).where(eq(orders.id, order.id));
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "payment",
        actorId: ctx.user.id,
        before: { paymentType: order.paymentType },
        after: {
          paymentType: payment.paymentType,
          paymentMethod: payment.paymentMethod,
          cashReceived: payment.cashReceived,
          changeAmount: payment.changeAmount,
        },
      });
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        changeAmount: payment.changeAmount,
      };
    });
  });
}

/** Soft delete with mandatory reason; stock returns to the same lots. */
export async function deleteOrder(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: ["owner", "manager"] });
    const r = reasonSchema.safeParse(raw);
    if (!r.success) throw new AppError("REASON_REQUIRED");
    const input = r.data;

    const result = await db.transaction(async (tx) => {
      const order = await lockOrder(tx, ctx.organizationId, input.orderId);
      const before = await snapshot(tx, order.id);
      if (order.status !== "Cancelled") await releaseOrderStock(tx, order.id);
      await tx
        .update(orders)
        .set({
          deletedAt: new Date(),
          deletedBy: ctx.user.id,
          deleteReason: input.reason,
        })
        .where(eq(orders.id, order.id));
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "delete",
        actorId: ctx.user.id,
        reason: input.reason,
        before,
      });
      return { id: order.id };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}

/** Owner restores a deleted order; stock is re-allocated FIFO (may fail). */
export async function restoreOrder(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: ["owner"] });
    const r = reasonSchema.pick({ orderId: true }).safeParse(raw);
    if (!r.success) throw new AppError("VALIDATION");

    const result = await db.transaction(async (tx) => {
      const order = await lockOrder(tx, ctx.organizationId, r.data.orderId, {
        deleted: true,
      });
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      if (order.status !== "Cancelled") {
        await lockProducts(
          tx,
          ctx.organizationId,
          items.map((i) => i.productId),
        );
        for (const item of items) {
          await allocateForItem(tx, {
            organizationId: ctx.organizationId,
            orderItemId: item.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
          });
        }
        await syncProductStock(
          tx,
          items.map((i) => i.productId),
        );
      }
      await tx
        .update(orders)
        .set({ deletedAt: null, deletedBy: null, deleteReason: null })
        .where(eq(orders.id, order.id));
      await audit(tx, {
        organizationId: ctx.organizationId,
        orderId: order.id,
        action: "restore",
        actorId: ctx.user.id,
        before: { deleteReason: order.deleteReason },
        after: await snapshot(tx, order.id),
      });
      return { id: order.id };
    });
    stockChanged(ctx.organizationId);
    return result;
  });
}
