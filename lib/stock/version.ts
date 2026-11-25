import "server-only";
import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { type Db, db, type Tx } from "@/db";
import { shopStockVersions } from "@/db/schema";

/** Cache tag for everything the public supplier stock page reads. */
export const supplierStockTag = (organizationId: string) =>
  `supplier-stock:${organizationId}`;

/** +1 on the shop's stock version. Call inside the mutating transaction. */
export async function bumpStockVersion(tx: Tx | Db, organizationId: string) {
  await tx
    .insert(shopStockVersions)
    .values({ organizationId, version: 1 })
    .onConflictDoUpdate({
      target: shopStockVersions.organizationId,
      set: { version: sql`${shopStockVersions.version} + 1` },
    });
}

export async function getStockVersion(organizationId: string) {
  const [row] = await db
    .select({ version: shopStockVersions.version })
    .from(shopStockVersions)
    .where(eq(shopStockVersions.organizationId, organizationId));
  return row?.version ?? 0;
}

/**
 * Expire the cached supplier stock after a committed stock/catalog/supplier
 * change (the version bump happened in the transaction). The cache is keyed
 * by stock version, so the next read already misses; stale-while-revalidate
 * is enough and, unlike updateTag(), doesn't make the Server Action re-render
 * the current route before responding.
 */
export function stockChanged(organizationId: string) {
  revalidateTag(supplierStockTag(organizationId), "max");
}
