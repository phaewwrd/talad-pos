import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import type { MemberContext } from "@/lib/permissions";
import type { CategoryDTO, ProductDTO } from "./types";

export function canSeeCost(ctx: Pick<MemberContext, "role">) {
  // TODO(decision): managers see cost for stock-in; cashiers never do (§8).
  return ctx.role === "owner" || ctx.role === "manager";
}

export async function listCategories(
  organizationId: string,
): Promise<CategoryDTO[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      orderNo: categories.orderNo,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.organizationId, organizationId))
    .groupBy(categories.id)
    .orderBy(asc(categories.orderNo), asc(categories.name));
}

export async function listProducts(
  ctx: Pick<MemberContext, "organizationId" | "role">,
  options: { activeOnly?: boolean } = {},
): Promise<ProductDTO[]> {
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      imageUrl: products.imageUrl,
      categoryId: products.categoryId,
      categoryName: categories.name,
      price: products.price,
      cost: products.cost,
      stockQuantity: products.stockQuantity,
      minimumStock: products.minimumStock,
      isActive: products.isActive,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.organizationId, ctx.organizationId),
        options.activeOnly ? eq(products.isActive, true) : undefined,
      ),
    )
    .orderBy(asc(categories.orderNo), asc(products.name));

  const showCost = canSeeCost(ctx);
  return rows.map(({ cost, ...rest }) => (showCost ? { ...rest, cost } : rest));
}
