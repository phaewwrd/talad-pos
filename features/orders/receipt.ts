import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import type { MemberContext } from "@/lib/permissions";
import { getOrderDetail } from "./queries";

export async function getReceipt(ctx: MemberContext, orderId: string) {
  const [order, [shop]] = await Promise.all([
    getOrderDetail(ctx, orderId),
    db
      .select()
      .from(shopSettings)
      .where(eq(shopSettings.organizationId, ctx.organizationId))
      .limit(1),
  ]);
  return { order, shop: shop ?? null };
}
