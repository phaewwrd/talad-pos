// Cross-tenant isolation: a member of shop A must never read or write shop B.
// Runs against a real Postgres only when TEST_DATABASE_URL is set (use a
// throwaway Neon branch with migrations applied):
//   TEST_DATABASE_URL=postgres://… pnpm test
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const ctxA = {
  user: { id: "", name: "Owner A", email: "", image: null },
  organizationId: "",
  role: "owner" as const,
  entitlements: {
    limits: { maxShops: 5, maxStaffPerShop: 5, maxProducts: 500 },
    features: {
      promotions: true,
      costProfit: true,
      export: true,
      platformChannels: true,
      multiShop: true,
    },
  },
  isPinSession: false,
};

// Every action/query resolves the caller as owner of shop A.
vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  return { ...actual, requireMember: vi.fn(async () => ctxA) };
});

describe.skipIf(!url)("tenant isolation (integration)", () => {
  const ids = {
    orgA: randomUUID(),
    orgB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    catB: randomUUID(),
    productB: randomUUID(),
    lotB: randomUUID(),
    orderB: randomUUID(),
  };

  beforeAll(async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    await db.insert(s.user).values([
      { id: ids.userA, name: "A", email: `a-${ids.userA}@test.invalid` },
      { id: ids.userB, name: "B", email: `b-${ids.userB}@test.invalid` },
    ]);
    await db.insert(s.organization).values([
      { id: ids.orgA, name: "Shop A", slug: `a-${ids.orgA}` },
      { id: ids.orgB, name: "Shop B", slug: `b-${ids.orgB}` },
    ]);
    await db.insert(s.member).values([
      { organizationId: ids.orgA, userId: ids.userA, role: "owner" },
      { organizationId: ids.orgB, userId: ids.userB, role: "owner" },
    ]);
    await db.insert(s.shopSettings).values([
      { organizationId: ids.orgA, displayName: "Shop A" },
      { organizationId: ids.orgB, displayName: "Shop B" },
    ]);
    await db
      .insert(s.categories)
      .values({ id: ids.catB, organizationId: ids.orgB, name: "B cat" });
    await db.insert(s.products).values({
      id: ids.productB,
      organizationId: ids.orgB,
      sku: "B-1",
      name: "B product",
      categoryId: ids.catB,
      price: "10.00",
      cost: "5.00",
      stockQuantity: 10,
    });
    await db.insert(s.productStockLots).values({
      id: ids.lotB,
      organizationId: ids.orgB,
      productId: ids.productB,
      lotNumber: "L1",
      stockInDate: "2026-10-01",
      initialQuantity: 10,
      remainingQuantity: 10,
      cost: "5.00",
    });
    await db.insert(s.orders).values({
      id: ids.orderB,
      organizationId: ids.orgB,
      orderNumber: "TL-261001-0001",
      subtotal: "10.00",
      total: "10.00",
    });
    ctxA.user.id = ids.userA;
    ctxA.organizationId = ids.orgA;
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(s.organization)
      .where(inArray(s.organization.id, [ids.orgA, ids.orgB]));
    await db.delete(s.user).where(inArray(s.user.id, [ids.userA, ids.userB]));
  });

  it("lists never include another shop's rows", async () => {
    const { listProducts, listCategories } = await import(
      "@/features/catalog/queries"
    );
    const { listOrders } = await import("@/features/orders/queries");
    const { getStock } = await import("@/features/stock/queries");
    expect(await listProducts(ctxA)).toEqual([]);
    expect(await listCategories(ids.orgA)).toEqual([]);
    expect(await listOrders(ctxA, {})).toEqual([]);
    expect((await getStock(ctxA)).products).toEqual([]);
  });

  it("detail reads of another shop's order fail", async () => {
    const { getOrderDetail } = await import("@/features/orders/queries");
    await expect(getOrderDetail(ctxA, ids.orderB)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("writes to another shop's rows fail and change nothing", async () => {
    const catalog = await import("@/features/catalog/actions");
    const stock = await import("@/features/stock/actions");
    const orders = await import("@/features/orders/actions");

    const product = await catalog.updateProduct(ids.productB, {
      name: "hacked",
      sku: "B-1",
      categoryId: ids.catB,
      price: "0.00",
      minimumStock: 0,
      isActive: true,
      imageUrl: null,
    });
    expect(product).toMatchObject({ ok: false });
    expect(await catalog.deleteCategory(ids.catB)).toMatchObject({ ok: false });
    expect(
      await stock.adjustStock({
        productId: ids.productB,
        lotId: ids.lotB,
        type: "waste",
        quantity: 5,
        reason: "x",
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await orders.createOrder({
        salesChannel: "storefront",
        items: [{ productId: ids.productB, quantity: 1 }],
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await orders.deleteOrder({ orderId: ids.orderB, reason: "x" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await orders.changeOrderStatus({
        orderId: ids.orderB,
        status: "Cancelled",
        reason: "x",
      }),
    ).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });

    const { db } = await import("@/db");
    const s = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [p] = await db
      .select()
      .from(s.products)
      .where(eq(s.products.id, ids.productB));
    const [lot] = await db
      .select()
      .from(s.productStockLots)
      .where(eq(s.productStockLots.id, ids.lotB));
    const [o] = await db
      .select()
      .from(s.orders)
      .where(eq(s.orders.id, ids.orderB));
    expect(p.name).toBe("B product");
    expect(lot.remainingQuantity).toBe(10);
    expect(o.deletedAt).toBeNull();
    expect(o.status).toBe("Pending");
  });
});
