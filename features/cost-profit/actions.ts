"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { costProfitEntries, products } from "@/db/schema";
import { AppError, runAction } from "@/lib/errors";
import { OWNER, requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import { entrySchema } from "./schemas";

const ownerOnly = () => requireMember({ roles: OWNER, feature: "costProfit" });

async function parse(raw: unknown, organizationId: string) {
  const r = entrySchema.safeParse(raw);
  if (!r.success) throw new AppError("VALIDATION");
  if (r.data.productId) {
    const [p] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, r.data.productId),
          eq(products.organizationId, organizationId),
        ),
      );
    if (!p) throw new AppError("VALIDATION");
  }
  return r.data;
}

export async function createEntry(raw: unknown) {
  return runAction(async () => {
    const ctx = await ownerOnly();
    const input = await parse(raw, ctx.organizationId);
    const [row] = await db
      .insert(costProfitEntries)
      .values({ organizationId: ctx.organizationId, ...input })
      .returning({ id: costProfitEntries.id });
    return row;
  });
}

export async function updateEntry(id: unknown, raw: unknown) {
  return runAction(async () => {
    const ctx = await ownerOnly();
    const entryId = uuid.parse(id);
    const input = await parse(raw, ctx.organizationId);
    const [row] = await db
      .update(costProfitEntries)
      .set(input)
      .where(
        and(
          eq(costProfitEntries.id, entryId),
          eq(costProfitEntries.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: costProfitEntries.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}

export async function deleteEntry(id: unknown) {
  return runAction(async () => {
    const ctx = await ownerOnly();
    const entryId = uuid.parse(id);
    const [row] = await db
      .delete(costProfitEntries)
      .where(
        and(
          eq(costProfitEntries.id, entryId),
          eq(costProfitEntries.organizationId, ctx.organizationId),
        ),
      )
      .returning({ id: costProfitEntries.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}
