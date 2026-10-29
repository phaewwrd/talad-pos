"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { assertCanCreateProduct } from "@/lib/entitlements";
import { AppError, runAction } from "@/lib/errors";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { bumpStockVersion, stockChanged } from "@/lib/stock/version";
import { canSeeCost } from "./queries";
import {
  categorySchema,
  productSchema,
  reorderCategoriesSchema,
} from "./schemas";

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

// ---------- Categories ----------

export async function createCategory(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const input = parse(categorySchema, raw);
    const [{ value }] = await db
      .select({ value: count() })
      .from(categories)
      .where(eq(categories.organizationId, ctx.organizationId));
    try {
      const [row] = await db
        .insert(categories)
        .values({
          organizationId: ctx.organizationId,
          name: input.name,
          orderNo: value,
        })
        .returning({ id: categories.id });
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("VALIDATION");
      throw err;
    }
  });
}

export async function updateCategory(id: unknown, raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const categoryId = parse(uuid, id);
    const input = parse(categorySchema, raw);
    const [row] = await db
      .update(categories)
      .set({ name: input.name })
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: categories.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}

export async function deleteCategory(id: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const categoryId = parse(uuid, id);
    const [{ value }] = await db
      .select({ value: count() })
      .from(products)
      .where(
        and(
          eq(products.categoryId, categoryId),
          eq(products.organizationId, ctx.organizationId),
        ),
      );
    if (value > 0) throw new AppError("CATEGORY_IN_USE");
    const [row] = await db
      .delete(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: categories.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}

export async function reorderCategories(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const { ids } = parse(reorderCategoriesSchema, raw);
    await db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.organizationId, ctx.organizationId),
            inArray(categories.id, ids),
          ),
        );
      if (owned.length !== ids.length) throw new AppError("NOT_FOUND");
      for (const [orderNo, id] of ids.entries()) {
        await tx
          .update(categories)
          .set({ orderNo })
          .where(
            and(
              eq(categories.id, id),
              eq(categories.organizationId, ctx.organizationId),
            ),
          );
      }
    });
    return { ok: true as const };
  });
}

// ---------- Products ----------

async function assertCategoryInOrg(categoryId: string, organizationId: string) {
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!cat) throw new AppError("VALIDATION");
}

export async function createProduct(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const input = parse(productSchema, raw);
    await assertCanCreateProduct(ctx.organizationId, ctx.entitlements);
    await assertCategoryInOrg(input.categoryId, ctx.organizationId);
    try {
      const [row] = await db
        .insert(products)
        .values({
          organizationId: ctx.organizationId,
          sku: input.sku,
          name: input.name,
          categoryId: input.categoryId,
          price: input.price,
          cost: canSeeCost(ctx) ? (input.cost ?? "0") : "0",
          minimumStock: input.minimumStock,
          isActive: input.isActive,
          imageUrl: input.imageUrl,
        })
        .returning({ id: products.id });
      await bumpStockVersion(db, ctx.organizationId);
      stockChanged(ctx.organizationId);
      return row;
    } catch (err) {
      if (isUniqueViolation(err, "products_org_sku_key"))
        throw new AppError("SKU_TAKEN");
      throw err;
    }
  });
}

export async function updateProduct(id: unknown, raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const productId = parse(uuid, id);
    const input = parse(productSchema, raw);
    await assertCategoryInOrg(input.categoryId, ctx.organizationId);
    try {
      const [row] = await db
        .update(products)
        .set({
          sku: input.sku,
          name: input.name,
          categoryId: input.categoryId,
          price: input.price,
          ...(canSeeCost(ctx) && input.cost !== undefined
            ? { cost: input.cost }
            : {}),
          minimumStock: input.minimumStock,
          isActive: input.isActive,
          imageUrl: input.imageUrl,
        })
        .where(
          and(
            eq(products.id, productId),
            eq(products.organizationId, ctx.organizationId),
          ),
        )
        .returning({ id: products.id });
      if (!row) throw new AppError("NOT_FOUND");
      await bumpStockVersion(db, ctx.organizationId);
      stockChanged(ctx.organizationId);
      return row;
    } catch (err) {
      if (isUniqueViolation(err, "products_org_sku_key"))
        throw new AppError("SKU_TAKEN");
      throw err;
    }
  });
}
