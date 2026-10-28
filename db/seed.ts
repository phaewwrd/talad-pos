// Demo data: platform admin, one signup invite, a demo shop with categories,
// ~20 products with FIFO lots, promotions, PIN staff and 30 days of orders.
//   pnpm db:seed            (refuses to run twice)
// Uses the same pricing/FIFO engines as the app so totals are consistent.
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  categories,
  type EntitlementFeatures,
  type EntitlementLimits,
  member,
  orderAuditLogs,
  orderItemLotAllocations,
  orderItems,
  orderPromotions,
  orders,
  organization,
  ownerEntitlements,
  type PaymentMethod,
  productStockLots,
  products,
  promotionCategories,
  promotionProducts,
  promotions,
  type SalesChannel,
  shopSettings,
  signupInvites,
  staffCredentials,
  stockAdjustments,
  user,
} from "@/db/schema";
import { money, toMoneyString } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orders/order-number";
import { calculateOrder } from "@/lib/pricing/calculate-order";
import type { PromotionRule } from "@/lib/promotions/apply";
import { allocateFifo } from "@/lib/stock/fifo";
import { addDays, bangkokDateString, startOfBangkokDay } from "@/lib/time";

const ADMIN = {
  email: "admin@talad.local",
  password: "Admin1234!",
  name: "Platform Admin",
};
const OWNER = {
  email: "owner@talad.local",
  password: "Owner1234!",
  name: "ป้าแดง",
};
const STAFF = [
  { name: "สมชาย (ผู้จัดการ)", role: "manager", pin: "1234" },
  { name: "มานี (แคชเชียร์)", role: "cashier", pin: "5678" },
] as const;

const FULL_LIMITS: EntitlementLimits = {
  maxShops: 3,
  maxStaffPerShop: 10,
  maxProducts: 500,
};
const FULL_FEATURES: EntitlementFeatures = {
  promotions: true,
  costProfit: true,
  export: true,
  platformChannels: true,
  multiShop: true,
};

const CATALOG: Record<string, [name: string, price: string, cost: string][]> = {
  อาหารจานเดียว: [
    ["ข้าวกะเพราหมูสับไข่ดาว", "60.00", "28.00"],
    ["ข้าวผัดกุ้ง", "70.00", "34.00"],
    ["ข้าวมันไก่", "55.00", "24.00"],
    ["ข้าวหมูแดง", "55.00", "25.00"],
    ["ผัดไทยกุ้งสด", "75.00", "35.00"],
  ],
  ก๋วยเตี๋ยว: [
    ["ก๋วยเตี๋ยวเรือหมู", "50.00", "20.00"],
    ["เย็นตาโฟ", "55.00", "22.00"],
    ["บะหมี่เกี๊ยวหมูแดง", "60.00", "26.00"],
    ["ราดหน้าหมู", "60.00", "25.00"],
  ],
  เครื่องดื่ม: [
    ["ชาไทยเย็น", "35.00", "10.00"],
    ["กาแฟเย็น", "40.00", "12.00"],
    ["ชามะนาว", "35.00", "9.00"],
    ["น้ำเปล่า", "10.00", "4.00"],
    ["โค้ก", "20.00", "11.00"],
  ],
  ของหวาน: [
    ["ข้าวเหนียวมะม่วง", "80.00", "38.00"],
    ["บัวลอยไข่หวาน", "40.00", "14.00"],
    ["ทับทิมกรอบ", "40.00", "15.00"],
  ],
  ของทานเล่น: [
    ["ไก่ทอด (3 ชิ้น)", "60.00", "27.00"],
    ["เกี๊ยวทอด", "45.00", "16.00"],
    ["ปอเปี๊ยะทอด", "45.00", "17.00"],
  ],
};

// Deterministic PRNG so the demo data is reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261028);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

const STAFF_EMAIL = (id: string) => `staff-${id}@pin.talad.invalid`;

async function main() {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, ADMIN.email));
  if (existing) {
    console.log(
      "Seed data already present (admin user exists). Nothing to do.",
    );
    return;
  }

  const now = new Date();
  const today = startOfBangkokDay(now);
  const inviteToken = randomBytes(24).toString("base64url");

  await db.transaction(async (tx) => {
    // ---------- Users ----------
    const [admin] = await tx
      .insert(user)
      .values({
        name: ADMIN.name,
        email: ADMIN.email,
        emailVerified: true,
        role: "admin",
      })
      .returning({ id: user.id });
    const [owner] = await tx
      .insert(user)
      .values({
        name: OWNER.name,
        email: OWNER.email,
        emailVerified: true,
        role: "user",
      })
      .returning({ id: user.id });
    for (const [u, pw] of [
      [admin, ADMIN.password],
      [owner, OWNER.password],
    ] as const) {
      await tx.insert(account).values({
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: await hashPassword(pw),
      });
    }

    await tx.insert(signupInvites).values({
      tokenHash: createHash("sha256").update(inviteToken).digest("hex"),
      label: "Demo invite",
      limits: { maxShops: 1, maxStaffPerShop: 3, maxProducts: 100 },
      features: { ...FULL_FEATURES, multiShop: false },
      expiresAt: addDays(now, 30),
      createdBy: admin.id,
    });

    // ---------- Shop ----------
    const [shop] = await tx
      .insert(organization)
      .values({
        name: "ร้านข้าวแกงป้าแดง",
        slug: `pa-daeng-${randomBytes(3).toString("hex")}`,
      })
      .returning({ id: organization.id });
    const organizationId = shop.id;
    await tx
      .insert(member)
      .values({ organizationId, userId: owner.id, role: "owner" });
    await tx.insert(ownerEntitlements).values({
      userId: owner.id,
      limits: FULL_LIMITS,
      features: FULL_FEATURES,
    });
    const settings = {
      vatEnabled: true,
      vatMode: "inclusive" as const,
      vatRate: "7.00",
      serviceChargeEnabled: false,
      serviceChargeRate: "10.00",
    };
    await tx.insert(shopSettings).values({
      organizationId,
      displayName: "ร้านข้าวแกงป้าแดง",
      address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
      phone: "02-123-4567",
      taxId: "0105555555555",
      promptpayId: "0812345678",
      orderNumberPrefix: "TL",
      receiptHeader: "ขอบคุณที่อุดหนุนค่ะ",
      receiptFooter: "แล้วพบกันใหม่ 🙏",
      expiryAlertDays: 7,
      ...settings,
    });

    // ---------- Staff ----------
    const staffIds: string[] = [];
    for (const s of STAFF) {
      const id = crypto.randomUUID();
      await tx.insert(user).values({
        id,
        name: s.name,
        email: STAFF_EMAIL(id),
        emailVerified: false,
      });
      await tx
        .insert(member)
        .values({ organizationId, userId: id, role: s.role });
      await tx.insert(staffCredentials).values({
        userId: id,
        organizationId,
        pinHash: await bcrypt.hash(s.pin, 10),
      });
      staffIds.push(id);
    }
    const sellers = [owner.id, ...staffIds];

    // ---------- Catalog + lots ----------
    type SeedProduct = {
      id: string;
      categoryId: string;
      name: string;
      price: string;
      lots: {
        id: string;
        stockInDate: string;
        createdAt: Date;
        remainingQuantity: number;
        initial: number;
        cost: string;
      }[];
    };
    const catalog: SeedProduct[] = [];
    const categoryIds: Record<string, string> = {};
    let order = 0;
    let skuNo = 1;
    for (const [categoryName, items] of Object.entries(CATALOG)) {
      const [cat] = await tx
        .insert(categories)
        .values({ organizationId, name: categoryName, orderNo: order++ })
        .returning({ id: categories.id });
      categoryIds[categoryName] = cat.id;

      for (const [name, price, cost] of items) {
        const sku = `SKU-${String(skuNo++).padStart(3, "0")}`;
        const [p] = await tx
          .insert(products)
          .values({
            organizationId,
            sku,
            name,
            categoryId: cat.id,
            price,
            cost,
            minimumStock: 15,
            stockQuantity: 0,
          })
          .returning({ id: products.id });

        // Two lots: an older one and a newer one at a slightly higher cost.
        const lotSpecs = [
          { daysAgo: 35, qty: between(140, 200), cost },
          {
            daysAgo: 12,
            qty: between(80, 140),
            cost: toMoneyString(money(cost).times(1.05)),
          },
        ];
        const lots: SeedProduct["lots"] = [];
        for (const [i, spec] of lotSpecs.entries()) {
          const inDate = addDays(today, -spec.daysAgo);
          const expiry =
            categoryName === "เครื่องดื่ม" || categoryName === "ของหวาน"
              ? bangkokDateString(addDays(today, i === 0 ? 5 : 60))
              : null;
          const [lot] = await tx
            .insert(productStockLots)
            .values({
              organizationId,
              productId: p.id,
              lotNumber: `L${bangkokDateString(inDate).replaceAll("-", "")}-${i + 1}`,
              stockInDate: bangkokDateString(inDate),
              expiryDate: expiry,
              initialQuantity: spec.qty,
              remainingQuantity: spec.qty,
              cost: spec.cost,
              createdAt: inDate,
            })
            .returning({ id: productStockLots.id });
          await tx.insert(stockAdjustments).values({
            organizationId,
            productId: p.id,
            lotId: lot.id,
            type: "stock_in",
            quantity: spec.qty,
            reason: "Seed stock-in",
            actorId: owner.id,
            createdAt: inDate,
          });
          lots.push({
            id: lot.id,
            stockInDate: bangkokDateString(inDate),
            createdAt: inDate,
            remainingQuantity: spec.qty,
            initial: spec.qty,
            cost: spec.cost,
          });
        }
        catalog.push({ id: p.id, categoryId: cat.id, name, price, lots });
      }
    }

    // ---------- Promotions ----------
    const promoRules: PromotionRule[] = [];
    const promoDefs = [
      {
        name: "เครื่องดื่มลด 10% เมื่อซื้อ 2 แก้ว",
        discountType: "percentage" as const,
        discountValue: "10.00",
        minimumType: "quantity" as const,
        minimumQuantity: 2,
        minimumAmount: null,
        categoryIds: [categoryIds["เครื่องดื่ม"]],
        productIds: [] as string[],
      },
      {
        name: "ของหวานซื้อครบ ฿100 ลด ฿20",
        discountType: "fixed" as const,
        discountValue: "20.00",
        minimumType: "amount" as const,
        minimumQuantity: 1,
        minimumAmount: "100.00",
        categoryIds: [categoryIds["ของหวาน"]],
        productIds: [] as string[],
      },
    ];
    for (const def of promoDefs) {
      const startAt = addDays(today, -40);
      const endAt = addDays(today, 60);
      const [promo] = await tx
        .insert(promotions)
        .values({
          organizationId,
          name: def.name,
          discountType: def.discountType,
          discountValue: def.discountValue,
          minimumType: def.minimumType,
          minimumQuantity: def.minimumQuantity,
          minimumAmount: def.minimumAmount,
          startAt,
          endAt,
        })
        .returning({ id: promotions.id });
      for (const categoryId of def.categoryIds) {
        await tx
          .insert(promotionCategories)
          .values({ organizationId, promotionId: promo.id, categoryId });
      }
      for (const productId of def.productIds) {
        await tx
          .insert(promotionProducts)
          .values({ organizationId, promotionId: promo.id, productId });
      }
      promoRules.push({ ...def, id: promo.id, startAt, endAt, isActive: true });
    }

    // ---------- 30 days of orders ----------
    const channels: SalesChannel[] = [
      "storefront",
      "storefront",
      "storefront",
      "shopee",
      "lineman",
      "grab",
    ];
    let orderCount = 0;
    for (let day = 29; day >= 0; day--) {
      const dayStart = addDays(today, -day);
      const ordersToday = day === 0 ? 8 : between(8, 18);
      for (let seq = 1; seq <= ordersToday; seq++) {
        // Between 10:00 and 20:00 Bangkok, in order.
        const minutes = 600 + Math.floor(((seq - 0.5) / ordersToday) * 600);
        const createdAt = new Date(dayStart.getTime() + minutes * 60_000);
        if (createdAt > now) break;

        const lineCount = between(1, 4);
        const chosen = new Map<string, number>();
        for (let i = 0; i < lineCount; i++) {
          const p = pick(catalog);
          chosen.set(p.id, (chosen.get(p.id) ?? 0) + between(1, 2));
        }
        const lines = [...chosen].map(([productId, quantity]) => {
          const p = catalog.find((c) => c.id === productId) as SeedProduct;
          return {
            productId,
            categoryId: p.categoryId,
            productName: p.name,
            unitPrice: p.price,
            quantity,
          };
        });
        const calc = calculateOrder({
          lines,
          promotions: promoRules,
          serviceCharge: {
            enabled: settings.serviceChargeEnabled,
            rate: settings.serviceChargeRate,
          },
          vat: {
            mode: settings.vatEnabled ? settings.vatMode : "none",
            rate: settings.vatRate,
          },
          now: createdAt,
        });

        const isToday = day === 0;
        const status = isToday
          ? (["Pending", "In Progress", "Ready", "Completed"] as const)[seq % 4]
          : rand() < 0.04
            ? "Cancelled"
            : "Completed";
        const paid = status === "Completed" || (isToday && rand() < 0.5);
        const method: PaymentMethod = rand() < 0.55 ? "cash" : "promptpay";
        const total = money(calc.total);
        const cashReceived =
          paid && method === "cash"
            ? total.dividedBy(100).ceil().times(100)
            : null;

        const [o] = await tx
          .insert(orders)
          .values({
            organizationId,
            orderNumber: formatOrderNumber("TL", createdAt, seq),
            customerName:
              rand() < 0.8 ? "Walk-in" : pick(["คุณเอ", "คุณบี", "คุณนิด", "คุณต้น"]),
            paymentType: paid ? "Paid" : "Unpaid",
            paymentMethod: paid ? method : null,
            cashReceived: cashReceived ? toMoneyString(cashReceived) : null,
            changeAmount: cashReceived
              ? toMoneyString(cashReceived.minus(total))
              : null,
            salesChannel: pick(channels),
            status,
            subtotal: calc.subtotal,
            discountTotal: calc.discountTotal,
            serviceChargeRate: calc.serviceChargeRate,
            serviceChargeAmount: calc.serviceChargeAmount,
            vatMode: calc.vatMode,
            vatRate: calc.vatRate,
            vatAmount: calc.vatAmount,
            total: calc.total,
            paidAt: paid ? createdAt : null,
            createdBy: pick(sellers),
            createdAt,
            updatedAt: createdAt,
          })
          .returning({ id: orders.id });

        for (const line of calc.lines) {
          const [item] = await tx
            .insert(orderItems)
            .values({
              organizationId,
              orderId: o.id,
              productId: line.productId,
              productName: line.productName,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
            })
            .returning({ id: orderItems.id });
          // Cancelled orders returned their stock, so they keep no allocations.
          if (status === "Cancelled") continue;
          const product = catalog.find(
            (c) => c.id === line.productId,
          ) as SeedProduct;
          for (const alloc of allocateFifo(
            product.id,
            product.lots,
            line.quantity,
          )) {
            const lot = product.lots.find((l) => l.id === alloc.lotId);
            if (lot) lot.remainingQuantity -= alloc.quantity;
            await tx.insert(orderItemLotAllocations).values({
              organizationId,
              orderItemId: item.id,
              lotId: alloc.lotId,
              quantity: alloc.quantity,
              createdAt,
            });
          }
        }
        for (const p of calc.promotions) {
          await tx.insert(orderPromotions).values({
            organizationId,
            orderId: o.id,
            promotionId: p.promotionId,
            promotionName: p.promotionName,
            discountType: p.discountType,
            discountValue: p.discountValue,
            minimumType: p.minimumType,
            minimumQuantity: p.minimumQuantity,
            minimumAmount: p.minimumAmount,
            matchedQuantity: p.matchedQuantity,
            discountAmount: p.discountAmount,
            createdAt,
          });
        }
        await tx.insert(orderAuditLogs).values({
          organizationId,
          orderId: o.id,
          action: "create",
          actorId: owner.id,
          after: { total: calc.total, status },
          createdAt,
        });
        orderCount++;
      }
    }

    // ---------- Persist lot balances + products.stock_quantity ----------
    for (const p of catalog) {
      let stock = 0;
      for (const lot of p.lots) {
        stock += lot.remainingQuantity;
        await tx
          .update(productStockLots)
          .set({ remainingQuantity: lot.remainingQuantity })
          .where(eq(productStockLots.id, lot.id));
      }
      await tx
        .update(products)
        .set({ stockQuantity: stock })
        .where(eq(products.id, p.id));
    }
    // One product low on stock to show alerts.
    const low = catalog[catalog.length - 1];
    await tx
      .update(products)
      .set({ minimumStock: 500 })
      .where(eq(products.id, low.id));

    console.log(`Seeded ${catalog.length} products, ${orderCount} orders.`);
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  console.log(`
Platform admin : ${ADMIN.email} / ${ADMIN.password}
Demo owner     : ${OWNER.email} / ${OWNER.password}
Staff PINs     : ${STAFF.map((s) => `${s.name} ${s.pin}`).join(", ")}
Invite link    : ${appUrl}/th/signup?token=${inviteToken}
(The owner must open /th/pin once and choose “Use this device for POS” before staff can PIN in.)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
