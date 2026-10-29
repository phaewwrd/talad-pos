import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { db } from "@/db";
import {
  organization,
  productSuppliers,
  products,
  shopSettings,
  supplierLinkViews,
  supplierShareLinks,
  suppliers,
} from "@/db/schema";
import { getStockVersion, supplierStockTag } from "@/lib/stock/version";
import { isTokenShaped } from "./security";
import type { PublicStock, PublicStockItem, StockStatus } from "./types";

export type PublicLink = NonNullable<Awaited<ReturnType<typeof findLink>>>;

/** Enabled link for this token, or null (unknown, disabled or regenerated). */
export const findLink = cache(async (token: string) => {
  if (!isTokenShaped(token)) return null;
  const [link] = await db
    .select({
      id: supplierShareLinks.id,
      organizationId: supplierShareLinks.organizationId,
      supplierId: supplierShareLinks.supplierId,
      token: supplierShareLinks.token,
      pinHash: supplierShareLinks.pinHash,
      pinUpdatedAt: supplierShareLinks.pinUpdatedAt,
      displayMode: supplierShareLinks.displayMode,
      lowStockThreshold: supplierShareLinks.lowStockThreshold,
    })
    .from(supplierShareLinks)
    .where(
      and(
        eq(supplierShareLinks.token, token),
        eq(supplierShareLinks.isEnabled, true),
      ),
    );
  return link ?? null;
});

/**
 * Raw stock for one supplier's products. Cached per shop stock version (so a
 * newer version is always a cache miss, even on another instance) and tagged
 * so stock-changing Server Actions expire it with updateTag().
 */
export async function getSupplierStock(
  organizationId: string,
  supplierId: string,
  version: number,
) {
  "use cache";
  cacheTag(supplierStockTag(organizationId));
  cacheLife("hours");
  void version;

  const [names] = await db
    .select({
      shopName: sql<string>`COALESCE(${shopSettings.displayName}, ${organization.name})`,
      supplierName: suppliers.name,
    })
    .from(suppliers)
    .innerJoin(organization, eq(organization.id, suppliers.organizationId))
    .leftJoin(
      shopSettings,
      eq(shopSettings.organizationId, suppliers.organizationId),
    )
    .where(
      and(
        eq(suppliers.id, supplierId),
        eq(suppliers.organizationId, organizationId),
      ),
    );
  // Only what the public page may show: no prices, costs or ids.
  const rows = await db
    .select({
      sku: products.sku,
      name: products.name,
      imageUrl: products.imageUrl,
      quantity: products.stockQuantity,
      minimumStock: products.minimumStock,
    })
    .from(productSuppliers)
    .innerJoin(products, eq(products.id, productSuppliers.productId))
    .where(
      and(
        eq(productSuppliers.supplierId, supplierId),
        eq(productSuppliers.organizationId, organizationId),
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
      ),
    )
    .orderBy(asc(products.name));
  return { names: names ?? null, rows };
}

const STATUS_ORDER: Record<StockStatus, number> = { out: 0, low: 1, in: 2 };

/** Apply the link's display settings to the cached rows. */
export async function loadPublicStock(link: PublicLink): Promise<PublicStock> {
  const version = await getStockVersion(link.organizationId);
  const { names, rows } = await getSupplierStock(
    link.organizationId,
    link.supplierId,
    version,
  );
  const items: PublicStockItem[] = rows.map((r) => {
    const threshold = link.lowStockThreshold ?? r.minimumStock;
    const status: StockStatus =
      r.quantity === 0 ? "out" : r.quantity <= threshold ? "low" : "in";
    return {
      sku: r.sku,
      name: r.name,
      imageUrl: r.imageUrl,
      status,
      quantity: link.displayMode === "QUANTITY" ? r.quantity : null,
    };
  });
  items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return {
    version,
    shopName: names?.shopName ?? "",
    supplierName: names?.supplierName ?? "",
    items,
  };
}

/** Count a view at most once per visitor per 30 minutes. */
export async function recordView(
  linkId: string,
  ipHash: string,
  userAgent: string | null,
) {
  await db.transaction(async (tx) => {
    // Serialize concurrent requests from the same visitor so the
    // check-then-insert below can't double count.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${linkId}:${ipHash}`}))`,
    );
    const [recent] = await tx
      .select({ id: supplierLinkViews.id })
      .from(supplierLinkViews)
      .where(
        and(
          eq(supplierLinkViews.linkId, linkId),
          eq(supplierLinkViews.ipHash, ipHash),
          gt(supplierLinkViews.viewedAt, sql`now() - interval '30 minutes'`),
        ),
      )
      .limit(1);
    if (recent) return;
    await tx.insert(supplierLinkViews).values({
      linkId,
      ipHash,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    await tx
      .update(supplierShareLinks)
      .set({
        viewCount: sql`${supplierShareLinks.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(supplierShareLinks.id, linkId));
  });
}
