"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  productSuppliers,
  products,
  supplierShareLinks,
  suppliers,
} from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { AppError, runAction } from "@/lib/errors";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";
import { bumpStockVersion, stockChanged } from "@/lib/stock/version";
import {
  linkDisplaySchema,
  linkEnabledSchema,
  linkPinSchema,
  supplierIdSchema,
  supplierProductsSchema,
  supplierSchema,
  updateSupplierSchema,
} from "./schemas";
import { hashPin, newLinkToken } from "./security";

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

/**
 * Run a supplier change for the caller's shop. Every change can alter what an
 * open supplier page shows, so it bumps the stock version (same transaction)
 * and expires the cached supplier stock afterwards.
 */
async function mutate<T>(
  raw: unknown,
  schema: Parameters<typeof parse<T>>[0],
  fn: (tx: Tx, input: T, organizationId: string) => Promise<unknown>,
) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const input = parse(schema, raw);
    await db.transaction(async (tx) => {
      await fn(tx, input, ctx.organizationId);
      await bumpStockVersion(tx, ctx.organizationId);
    });
    stockChanged(ctx.organizationId);
    return { ok: true as const };
  });
}

async function assertSupplierInOrg(
  tx: Tx,
  supplierId: string,
  organizationId: string,
) {
  const [row] = await tx
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(
      and(
        eq(suppliers.id, supplierId),
        eq(suppliers.organizationId, organizationId),
      ),
    )
    .for("update");
  if (!row) throw new AppError("NOT_FOUND");
}

const linkWhere = (supplierId: string, organizationId: string) =>
  and(
    eq(supplierShareLinks.supplierId, supplierId),
    eq(supplierShareLinks.organizationId, organizationId),
  );

// ---------- Suppliers ----------

export async function createSupplier(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER_MANAGER });
    const input = parse(supplierSchema, raw);
    try {
      return await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(suppliers)
          .values({ organizationId: ctx.organizationId, ...input })
          .returning({ id: suppliers.id });
        // Every supplier gets a link up front, disabled until the shop shares it.
        await tx.insert(supplierShareLinks).values({
          organizationId: ctx.organizationId,
          supplierId: row.id,
          token: newLinkToken(),
        });
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err, "suppliers_org_name_key"))
        throw new AppError("VALIDATION", { field: "name" });
      throw err;
    }
  });
}

export async function updateSupplier(raw: unknown) {
  return mutate(
    raw,
    updateSupplierSchema,
    async (tx, { supplierId, ...input }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      try {
        await tx
          .update(suppliers)
          .set(input)
          .where(eq(suppliers.id, supplierId));
      } catch (err) {
        if (isUniqueViolation(err, "suppliers_org_name_key"))
          throw new AppError("VALIDATION", { field: "name" });
        throw err;
      }
    },
  );
}

/** Deleting a supplier also deletes its link, so the URL stops working. */
export async function deleteSupplier(raw: unknown) {
  return mutate(
    raw,
    supplierIdSchema,
    async (tx, { supplierId }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx.delete(suppliers).where(eq(suppliers.id, supplierId));
    },
  );
}

/** Replace the set of products this supplier supplies. */
export async function setSupplierProducts(raw: unknown) {
  return mutate(
    raw,
    supplierProductsSchema,
    async (tx, { supplierId, productIds }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      const ids = [...new Set(productIds)];
      if (ids.length) {
        const owned = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              inArray(products.id, ids),
              eq(products.organizationId, organizationId),
            ),
          );
        if (owned.length !== ids.length) throw new AppError("NOT_FOUND");
      }
      await tx
        .delete(productSuppliers)
        .where(eq(productSuppliers.supplierId, supplierId));
      if (ids.length) {
        await tx
          .insert(productSuppliers)
          .values(
            ids.map((productId) => ({ organizationId, supplierId, productId })),
          );
      }
    },
  );
}

// ---------- Share link ----------

export async function setLinkEnabled(raw: unknown) {
  return mutate(
    raw,
    linkEnabledSchema,
    async (tx, { supplierId, isEnabled }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx
        .update(supplierShareLinks)
        .set({ isEnabled })
        .where(linkWhere(supplierId, organizationId));
    },
  );
}

/** New token: the old URL stops working immediately. The PIN is kept. */
export async function regenerateLink(raw: unknown) {
  return mutate(
    raw,
    supplierIdSchema,
    async (tx, { supplierId }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx
        .update(supplierShareLinks)
        .set({ token: newLinkToken(), regeneratedAt: new Date() })
        .where(linkWhere(supplierId, organizationId));
    },
  );
}

/** Set or change the PIN. Devices unlocked with the old PIN must re-enter it. */
export async function setLinkPin(raw: unknown) {
  return mutate(
    raw,
    linkPinSchema,
    async (tx, { supplierId, pin }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx
        .update(supplierShareLinks)
        .set({ pinHash: await hashPin(pin), pinUpdatedAt: new Date() })
        .where(linkWhere(supplierId, organizationId));
    },
  );
}

export async function removeLinkPin(raw: unknown) {
  return mutate(
    raw,
    supplierIdSchema,
    async (tx, { supplierId }, organizationId) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx
        .update(supplierShareLinks)
        .set({ pinHash: null, pinUpdatedAt: new Date() })
        .where(linkWhere(supplierId, organizationId));
    },
  );
}

export async function updateLinkDisplay(raw: unknown) {
  return mutate(
    raw,
    linkDisplaySchema,
    async (
      tx,
      { supplierId, displayMode, lowStockThreshold },
      organizationId,
    ) => {
      await assertSupplierInOrg(tx, supplierId, organizationId);
      await tx
        .update(supplierShareLinks)
        .set({ displayMode, lowStockThreshold })
        .where(linkWhere(supplierId, organizationId));
    },
  );
}
