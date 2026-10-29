import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  productSuppliers,
  products,
  supplierShareLinks,
  suppliers,
} from "@/db/schema";
import type { SuppliersBundle } from "./types";

export async function listSuppliers(
  organizationId: string,
): Promise<SuppliersBundle> {
  const [rows, links, productLinks, productRows] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contact: suppliers.contact,
      })
      .from(suppliers)
      .where(eq(suppliers.organizationId, organizationId))
      .orderBy(asc(suppliers.name)),
    db
      .select({
        supplierId: supplierShareLinks.supplierId,
        token: supplierShareLinks.token,
        isEnabled: supplierShareLinks.isEnabled,
        pinHash: supplierShareLinks.pinHash,
        displayMode: supplierShareLinks.displayMode,
        lowStockThreshold: supplierShareLinks.lowStockThreshold,
        viewCount: supplierShareLinks.viewCount,
        lastViewedAt: supplierShareLinks.lastViewedAt,
      })
      .from(supplierShareLinks)
      .where(eq(supplierShareLinks.organizationId, organizationId)),
    db
      .select({
        supplierId: productSuppliers.supplierId,
        productId: productSuppliers.productId,
      })
      .from(productSuppliers)
      .where(eq(productSuppliers.organizationId, organizationId)),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(asc(products.name)),
  ]);

  const linkBySupplier = new Map(links.map((l) => [l.supplierId, l]));
  const productsBySupplier = new Map<string, string[]>();
  for (const p of productLinks) {
    const list = productsBySupplier.get(p.supplierId) ?? [];
    list.push(p.productId);
    productsBySupplier.set(p.supplierId, list);
  }

  return {
    suppliers: rows.flatMap((s) => {
      const link = linkBySupplier.get(s.id);
      if (!link) return [];
      return [
        {
          ...s,
          productIds: productsBySupplier.get(s.id) ?? [],
          link: {
            token: link.token,
            isEnabled: link.isEnabled,
            hasPin: link.pinHash !== null,
            displayMode: link.displayMode,
            lowStockThreshold: link.lowStockThreshold,
            viewCount: link.viewCount,
            lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
          },
        },
      ];
    }),
    products: productRows,
  };
}
