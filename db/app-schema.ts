// POS application tables. Every business row belongs to one Better Auth
// organization (= one shop / tenant).

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

// ---------- Shared column helpers ----------
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

// ---------- Types ----------
export type PaymentType = "Paid" | "Unpaid";
export type SalesChannel = "storefront" | "shopee" | "lineman" | "grab";
export type DiscountType = "percentage" | "fixed";
export type MinimumType = "quantity" | "amount";
export type CostProfitChannel = "shopee" | "lineman" | "other";
export type PaymentMethod = "cash" | "promptpay";
export type VatMode = "none" | "inclusive" | "exclusive";
export const ORDER_STATUSES = [
  "Pending",
  "In Progress",
  "Ready",
  "Completed",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderAuditAction =
  | "create"
  | "update"
  | "status_change"
  | "payment"
  | "delete"
  | "restore";
export type StockAdjustmentType =
  | "stock_in"
  | "adjust_up"
  | "adjust_down"
  | "waste"
  | "sale_return";
/** `null` = unlimited. */
export type EntitlementLimits = {
  maxShops: number | null;
  maxStaffPerShop: number | null;
  maxProducts: number | null;
};
export type EntitlementFeatures = {
  promotions: boolean;
  costProfit: boolean;
  export: boolean;
  platformChannels: boolean;
  multiShop: boolean;
};

// =====================================================================
// Catalog
// =====================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    orderNo: integer("order_no").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("categories_org_name_key").on(t.organizationId, t.name),
    index("idx_categories_org_order").on(t.organizationId, t.orderNo),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    minimumStock: integer("minimum_stock").notNull().default(0),
    cost: money("cost").notNull(),
    price: money("price").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("products_org_sku_key").on(t.organizationId, t.sku),
    check("products_stock_quantity_check", sql`${t.stockQuantity} >= 0`),
    check("products_minimum_stock_check", sql`${t.minimumStock} >= 0`),
    check("products_cost_check", sql`${t.cost} >= 0`),
    check("products_price_check", sql`${t.price} >= 0`),
    index("idx_products_org_category").on(t.organizationId, t.categoryId),
  ],
);

export const productStockLots = pgTable(
  "product_stock_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    lotNumber: text("lot_number").notNull(),
    stockInDate: date("stock_in_date").notNull(),
    expiryDate: date("expiry_date"),
    initialQuantity: integer("initial_quantity").notNull(),
    remainingQuantity: integer("remaining_quantity").notNull(),
    cost: money("cost").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("product_stock_lots_product_id_lot_number_key").on(
      t.productId,
      t.lotNumber,
    ),
    check(
      "product_stock_lots_initial_quantity_check",
      sql`${t.initialQuantity} >= 0`,
    ),
    check(
      "product_stock_lots_remaining_quantity_check",
      sql`${t.remainingQuantity} >= 0 AND ${t.remainingQuantity} <= ${t.initialQuantity}`,
    ),
    check("product_stock_lots_cost_check", sql`${t.cost} >= 0`),
    index("idx_product_stock_lots_org").on(t.organizationId),
    index("idx_product_stock_lots_fifo").on(
      t.productId,
      t.stockInDate.asc(),
      t.createdAt.asc(),
    ),
  ],
);

// =====================================================================
// Orders
// =====================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull().default("Walk-in"),
    paymentType: text("payment_type")
      .$type<PaymentType>()
      .notNull()
      .default("Paid"),
    salesChannel: text("sales_channel")
      .$type<SalesChannel>()
      .notNull()
      .default("storefront"),
    status: text("status").$type<OrderStatus>().notNull().default("Pending"),
    subtotal: money("subtotal").notNull(),
    discountTotal: money("discount_total").notNull().default("0"),
    total: money("total").notNull(),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // --- 0001 additions ---
    paymentMethod: text("payment_method").$type<PaymentMethod>(),
    cashReceived: money("cash_received"),
    changeAmount: money("change_amount"),
    serviceChargeRate: numeric("service_charge_rate", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("0"),
    serviceChargeAmount: money("service_charge_amount").notNull().default("0"),
    vatMode: text("vat_mode").$type<VatMode>().notNull().default("none"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    vatAmount: money("vat_amount").notNull().default("0"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (t) => [
    unique("orders_org_order_number_key").on(t.organizationId, t.orderNumber),
    check(
      "orders_payment_type_check",
      sql`${t.paymentType} IN ('Paid', 'Unpaid')`,
    ),
    check(
      "orders_sales_channel_check",
      sql`${t.salesChannel} IN ('storefront', 'shopee', 'lineman', 'grab')`,
    ),
    check("orders_subtotal_check", sql`${t.subtotal} >= 0`),
    check("orders_discount_total_check", sql`${t.discountTotal} >= 0`),
    check("orders_total_check", sql`${t.total} >= 0`),
    index("idx_orders_org_created_at").on(t.organizationId, t.createdAt.desc()),
    check(
      "orders_payment_method_check",
      sql`${t.paymentMethod} IS NULL OR ${t.paymentMethod} IN ('cash', 'promptpay')`,
    ),
    check(
      "orders_vat_mode_check",
      sql`${t.vatMode} IN ('none', 'inclusive', 'exclusive')`,
    ),
    index("idx_orders_org_deleted_created").on(
      t.organizationId,
      t.deletedAt,
      t.createdAt.desc(),
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    discountAmount: money("discount_amount").notNull().default("0"),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [
    check("order_items_quantity_check", sql`${t.quantity} > 0`),
    check("order_items_unit_price_check", sql`${t.unitPrice} >= 0`),
    check("order_items_discount_amount_check", sql`${t.discountAmount} >= 0`),
    check("order_items_line_total_check", sql`${t.lineTotal} >= 0`),
    index("idx_order_items_order_id").on(t.orderId),
    index("idx_order_items_org_product").on(t.organizationId, t.productId),
  ],
);

export const orderItemLotAllocations = pgTable(
  "order_item_lot_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => productStockLots.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_item_lot_allocations_quantity_check", sql`${t.quantity} > 0`),
    index("idx_order_item_lot_allocations_order_item_id").on(t.orderItemId),
    index("idx_order_item_lot_allocations_lot_id").on(t.lotId),
  ],
);

// =====================================================================
// Promotions
// =====================================================================

export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    discountType: text("discount_type").$type<DiscountType>().notNull(),
    discountValue: money("discount_value").notNull(),
    minimumType: text("minimum_type")
      .$type<MinimumType>()
      .notNull()
      .default("quantity"),
    minimumQuantity: integer("minimum_quantity").notNull(),
    minimumAmount: money("minimum_amount"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "promotions_discount_type_check",
      sql`${t.discountType} IN ('percentage', 'fixed')`,
    ),
    check("promotions_discount_value_check", sql`${t.discountValue} >= 0`),
    check(
      "promotions_minimum_type_check",
      sql`${t.minimumType} IN ('quantity', 'amount')`,
    ),
    check("promotions_minimum_quantity_check", sql`${t.minimumQuantity} > 0`),
    check("promotions_check", sql`${t.endAt} >= ${t.startAt}`),
    index("idx_promotions_org_active_window").on(
      t.organizationId,
      t.isActive,
      t.startAt,
      t.endAt,
    ),
  ],
);

export const promotionProducts = pgTable(
  "promotion_products",
  {
    organizationId: organizationId(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.productId] }),
    index("idx_promotion_products_product_id").on(t.productId),
  ],
);

export const promotionCategories = pgTable(
  "promotion_categories",
  {
    organizationId: organizationId(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.categoryId] }),
    index("idx_promotion_categories_category_id").on(t.categoryId),
  ],
);

export const orderPromotions = pgTable(
  "order_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    promotionId: uuid("promotion_id").references(() => promotions.id, {
      onDelete: "set null",
    }),
    promotionName: text("promotion_name").notNull(),
    discountType: text("discount_type").$type<DiscountType>().notNull(),
    discountValue: money("discount_value").notNull(),
    minimumType: text("minimum_type")
      .$type<MinimumType>()
      .notNull()
      .default("quantity"),
    minimumQuantity: integer("minimum_quantity").notNull(),
    minimumAmount: money("minimum_amount"),
    matchedQuantity: integer("matched_quantity").notNull(),
    discountAmount: money("discount_amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "order_promotions_discount_type_check",
      sql`${t.discountType} IN ('percentage', 'fixed')`,
    ),
    check(
      "order_promotions_discount_value_check",
      sql`${t.discountValue} >= 0`,
    ),
    check(
      "order_promotions_minimum_type_check",
      sql`${t.minimumType} IN ('quantity', 'amount')`,
    ),
    check(
      "order_promotions_minimum_quantity_check",
      sql`${t.minimumQuantity} > 0`,
    ),
    check(
      "order_promotions_matched_quantity_check",
      sql`${t.matchedQuantity} > 0`,
    ),
    check(
      "order_promotions_discount_amount_check",
      sql`${t.discountAmount} >= 0`,
    ),
    index("idx_order_promotions_order_id").on(t.orderId),
  ],
);

// =====================================================================
// Cost / profit
// =====================================================================

export const costProfitEntries = pgTable(
  "cost_profit_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    entryDate: date("entry_date").notNull(),
    salesChannel: text("sales_channel").$type<CostProfitChannel>().notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: money("unit_cost").notNull(),
    unitPrice: money("unit_price").notNull(),
    platformFeeRate: numeric("platform_fee_rate", { precision: 6, scale: 4 })
      .notNull()
      .default("0"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "cost_profit_entries_sales_channel_check",
      sql`${t.salesChannel} IN ('shopee', 'lineman', 'other')`,
    ),
    check("cost_profit_entries_quantity_check", sql`${t.quantity} > 0`),
    check("cost_profit_entries_unit_cost_check", sql`${t.unitCost} >= 0`),
    check("cost_profit_entries_unit_price_check", sql`${t.unitPrice} >= 0`),
    check(
      "cost_profit_entries_platform_fee_rate_check",
      sql`${t.platformFeeRate} >= 0`,
    ),
    index("idx_cost_profit_entries_org_date").on(
      t.organizationId,
      t.entryDate.desc(),
    ),
    index("idx_cost_profit_entries_org_channel").on(
      t.organizationId,
      t.salesChannel,
    ),
  ],
);

// =====================================================================
// Shop settings, staff, devices, audit, stock movements (0001)
// =====================================================================

export const shopSettings = pgTable(
  "shop_settings",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    logoUrl: text("logo_url"),
    address: text("address"),
    phone: text("phone"),
    taxId: text("tax_id"),
    promptpayId: text("promptpay_id"),
    orderNumberPrefix: text("order_number_prefix").notNull().default("TL"),
    vatEnabled: boolean("vat_enabled").notNull().default(false),
    vatMode: text("vat_mode")
      .$type<Exclude<VatMode, "none">>()
      .notNull()
      .default("inclusive"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("7.00"),
    serviceChargeEnabled: boolean("service_charge_enabled")
      .notNull()
      .default(false),
    serviceChargeRate: numeric("service_charge_rate", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("10.00"),
    receiptHeader: text("receipt_header"),
    receiptFooter: text("receipt_footer"),
    expiryAlertDays: integer("expiry_alert_days").notNull().default(7),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "shop_settings_vat_mode_check",
      sql`${t.vatMode} IN ('inclusive', 'exclusive')`,
    ),
    check(
      "shop_settings_vat_rate_check",
      sql`${t.vatRate} >= 0 AND ${t.vatRate} <= 100`,
    ),
    check(
      "shop_settings_service_charge_rate_check",
      sql`${t.serviceChargeRate} >= 0 AND ${t.serviceChargeRate} <= 100`,
    ),
    check(
      "shop_settings_expiry_alert_days_check",
      sql`${t.expiryAlertDays} >= 0`,
    ),
  ],
);

export const staffCredentials = pgTable(
  "staff_credentials",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: organizationId(),
    pinHash: text("pin_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_staff_credentials_org").on(t.organizationId)],
);

export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_trusted_devices_org").on(t.organizationId)],
);

export const orderAuditLogs = pgTable(
  "order_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    action: text("action").$type<OrderAuditAction>().notNull(),
    actorId: uuid("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "order_audit_logs_action_check",
      sql`${t.action} IN ('create', 'update', 'status_change', 'payment', 'delete', 'restore')`,
    ),
    index("idx_order_audit_logs_order").on(t.orderId, t.createdAt),
    index("idx_order_audit_logs_org").on(t.organizationId),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => productStockLots.id, {
      onDelete: "set null",
    }),
    type: text("type").$type<StockAdjustmentType>().notNull(),
    // Signed: positive adds stock, negative removes it.
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "stock_adjustments_type_check",
      sql`${t.type} IN ('stock_in', 'adjust_up', 'adjust_down', 'waste', 'sale_return')`,
    ),
    check("stock_adjustments_quantity_check", sql`${t.quantity} <> 0`),
    index("idx_stock_adjustments_org_created").on(
      t.organizationId,
      t.createdAt.desc(),
    ),
    index("idx_stock_adjustments_product").on(t.productId),
  ],
);

/**
 * Bumped (same transaction) by every stock change, so the public supplier
 * page can poll "has anything changed?" with one primary-key read.
 */
export const shopStockVersions = pgTable("shop_stock_versions", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  updatedAt: updatedAt(),
});

// =====================================================================
// Suppliers & public stock links
// =====================================================================

export const SUPPLIER_DISPLAY_MODES = ["QUANTITY", "STATUS"] as const;
export type SupplierDisplayMode = (typeof SUPPLIER_DISPLAY_MODES)[number];
export const SUPPLIER_ATTEMPT_KINDS = ["pin", "page", "api"] as const;
export type SupplierAttemptKind = (typeof SUPPLIER_ATTEMPT_KINDS)[number];

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    contact: text("contact"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("suppliers_org_name_key").on(t.organizationId, t.name),
    index("idx_suppliers_org").on(t.organizationId),
  ],
);

export const productSuppliers = pgTable(
  "product_suppliers",
  {
    organizationId: organizationId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.supplierId, t.productId] }),
    index("idx_product_suppliers_product").on(t.productId),
  ],
);

/** One share link per supplier. Valid until disabled or regenerated. */
export const supplierShareLinks = pgTable(
  "supplier_share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    // 32 random bytes, base64url. Never derived from ids.
    token: text("token").notNull().unique(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    pinHash: text("pin_hash"),
    // Part of the unlock-cookie signature: changing it logs out old devices.
    pinUpdatedAt: timestamp("pin_updated_at", { withTimezone: true }),
    displayMode: text("display_mode")
      .$type<SupplierDisplayMode>()
      .notNull()
      .default("QUANTITY"),
    // null = use each product's minimum_stock.
    lowStockThreshold: integer("low_stock_threshold"),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    regeneratedAt: timestamp("regenerated_at", { withTimezone: true }),
  },
  (t) => [
    unique("supplier_share_links_org_supplier_key").on(
      t.organizationId,
      t.supplierId,
    ),
    check(
      "supplier_share_links_display_mode_check",
      sql`${t.displayMode} IN ('QUANTITY', 'STATUS')`,
    ),
    check(
      "supplier_share_links_low_stock_threshold_check",
      sql`${t.lowStockThreshold} IS NULL OR ${t.lowStockThreshold} >= 0`,
    ),
  ],
);

/** ip_hash is an HMAC of the IP; the raw IP is never stored. */
export const supplierLinkViews = pgTable(
  "supplier_link_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => supplierShareLinks.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("idx_supplier_link_views_link_ip").on(
      t.linkId,
      t.ipHash,
      t.viewedAt.desc(),
    ),
  ],
);

/** Fixed-window counters for PIN attempts and request rate limits. */
export const supplierLinkAttempts = pgTable(
  "supplier_link_attempts",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => supplierShareLinks.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull(),
    kind: text("kind").$type<SupplierAttemptKind>().notNull(),
    count: integer("count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.linkId, t.ipHash, t.kind] }),
    check(
      "supplier_link_attempts_kind_check",
      sql`${t.kind} IN ('pin', 'page', 'api')`,
    ),
  ],
);

// ---------- Platform level (NOT org-scoped) ----------

export type EmailLocale = "th" | "en";

export const signupInvites = pgTable(
  "signup_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label").notNull(),
    email: text("email"),
    limits: jsonb("limits").$type<EntitlementLimits>().notNull(),
    features: jsonb("features").$type<EntitlementFeatures>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByUserId: uuid("used_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    // --- 0002 additions (backoffice) ---
    lockToEmail: boolean("lock_to_email").notNull().default(true),
    emailLocale: text("email_locale")
      .$type<EmailLocale>()
      .notNull()
      .default("th"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sendCount: integer("send_count").notNull().default(0),
    revokedBy: uuid("revoked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_signup_invites_created").on(t.createdAt.desc()),
    check(
      "signup_invites_email_locale_check",
      sql`${t.emailLocale} IN ('th', 'en')`,
    ),
  ],
);

export type InviteEmailStatus = "queued" | "sent" | "failed";

export const inviteEmailLogs = pgTable(
  "invite_email_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => signupInvites.id, { onDelete: "cascade" }),
    toEmail: text("to_email").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").$type<InviteEmailStatus>().notNull(),
    error: text("error"),
    sentBy: uuid("sent_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "invite_email_logs_status_check",
      sql`${t.status} IN ('queued', 'sent', 'failed')`,
    ),
    index("idx_invite_email_logs_invite").on(t.inviteId, t.createdAt.desc()),
  ],
);

export const ownerEntitlements = pgTable("owner_entitlements", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  limits: jsonb("limits").$type<EntitlementLimits>().notNull(),
  features: jsonb("features").$type<EntitlementFeatures>().notNull(),
  sourceInviteId: uuid("source_invite_id").references(() => signupInvites.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
  // --- 0002 addition ---
  updatedBy: uuid("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
});

export const SHOP_STATUSES = ["active", "suspended", "closed"] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

/** Platform-controlled shop state. No row = active. */
export const shopStatus = pgTable(
  "shop_status",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status").$type<ShopStatus>().notNull().default("active"),
    reason: text("reason"),
    changedBy: uuid("changed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "shop_status_status_check",
      sql`${t.status} IN ('active', 'suspended', 'closed')`,
    ),
  ],
);

export const AUDIT_TARGET_TYPES = [
  "shop",
  "user",
  "invite",
  "backoffice_user",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/**
 * Append-only: a trigger (migration 0002) rejects UPDATE/DELETE/TRUNCATE.
 * actor_id has no FK on purpose, so deleting a user never rewrites history.
 */
export const platformAuditLogs = pgTable(
  "platform_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").$type<AuditTargetType>().notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "platform_audit_logs_target_type_check",
      sql`${t.targetType} IN ('shop', 'user', 'invite', 'backoffice_user')`,
    ),
    index("idx_platform_audit_logs_target").on(
      t.targetType,
      t.targetId,
      t.createdAt.desc(),
    ),
    index("idx_platform_audit_logs_actor").on(t.actorId, t.createdAt.desc()),
    index("idx_platform_audit_logs_created").on(t.createdAt.desc()),
  ],
);

/** Backoffice login attempts, for the 5-failures-per-15-minutes rate limit. */
export const backofficeLoginAttempts = pgTable(
  "backoffice_login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    success: boolean("success").notNull(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_backoffice_login_attempts_email").on(
      t.email,
      t.createdAt.desc(),
    ),
  ],
);

// =====================================================================
// Relations (for db.query API)
// =====================================================================

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  organization: one(organization, {
    fields: [categories.organizationId],
    references: [organization.id],
  }),
  products: many(products),
  promotionCategories: many(promotionCategories),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organization, {
    fields: [products.organizationId],
    references: [organization.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  stockLots: many(productStockLots),
  orderItems: many(orderItems),
  promotionProducts: many(promotionProducts),
  costProfitEntries: many(costProfitEntries),
}));

export const productStockLotsRelations = relations(
  productStockLots,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productStockLots.productId],
      references: [products.id],
    }),
    allocations: many(orderItemLotAllocations),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organization, {
    fields: [orders.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [orders.createdBy],
    references: [user.id],
  }),
  items: many(orderItems),
  promotions: many(orderPromotions),
  auditLogs: many(orderAuditLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  lotAllocations: many(orderItemLotAllocations),
}));

export const orderItemLotAllocationsRelations = relations(
  orderItemLotAllocations,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemLotAllocations.orderItemId],
      references: [orderItems.id],
    }),
    lot: one(productStockLots, {
      fields: [orderItemLotAllocations.lotId],
      references: [productStockLots.id],
    }),
  }),
);

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [promotions.organizationId],
    references: [organization.id],
  }),
  products: many(promotionProducts),
  categories: many(promotionCategories),
  orderPromotions: many(orderPromotions),
}));

export const promotionProductsRelations = relations(
  promotionProducts,
  ({ one }) => ({
    promotion: one(promotions, {
      fields: [promotionProducts.promotionId],
      references: [promotions.id],
    }),
    product: one(products, {
      fields: [promotionProducts.productId],
      references: [products.id],
    }),
  }),
);

export const promotionCategoriesRelations = relations(
  promotionCategories,
  ({ one }) => ({
    promotion: one(promotions, {
      fields: [promotionCategories.promotionId],
      references: [promotions.id],
    }),
    category: one(categories, {
      fields: [promotionCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const orderPromotionsRelations = relations(
  orderPromotions,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderPromotions.orderId],
      references: [orders.id],
    }),
    promotion: one(promotions, {
      fields: [orderPromotions.promotionId],
      references: [promotions.id],
    }),
  }),
);

export const costProfitEntriesRelations = relations(
  costProfitEntries,
  ({ one }) => ({
    organization: one(organization, {
      fields: [costProfitEntries.organizationId],
      references: [organization.id],
    }),
    product: one(products, {
      fields: [costProfitEntries.productId],
      references: [products.id],
    }),
  }),
);

export const shopSettingsRelations = relations(shopSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [shopSettings.organizationId],
    references: [organization.id],
  }),
}));

export const staffCredentialsRelations = relations(
  staffCredentials,
  ({ one }) => ({
    user: one(user, {
      fields: [staffCredentials.userId],
      references: [user.id],
    }),
  }),
);

export const orderAuditLogsRelations = relations(orderAuditLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderAuditLogs.orderId],
    references: [orders.id],
  }),
  actor: one(user, {
    fields: [orderAuditLogs.actorId],
    references: [user.id],
  }),
}));

export const stockAdjustmentsRelations = relations(
  stockAdjustments,
  ({ one }) => ({
    product: one(products, {
      fields: [stockAdjustments.productId],
      references: [products.id],
    }),
    lot: one(productStockLots, {
      fields: [stockAdjustments.lotId],
      references: [productStockLots.id],
    }),
    actor: one(user, {
      fields: [stockAdjustments.actorId],
      references: [user.id],
    }),
  }),
);
