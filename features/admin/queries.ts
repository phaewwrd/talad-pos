import "server-only";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  member,
  orders,
  organization,
  ownerEntitlements,
  products,
  signupInvites,
  staffCredentials,
  user,
} from "@/db/schema";
import { inviteStatus } from "@/features/auth/invites";
import { normalizeEntitlements } from "@/lib/entitlements";

export async function listInvites() {
  const rows = await db
    .select({
      id: signupInvites.id,
      label: signupInvites.label,
      email: signupInvites.email,
      limits: signupInvites.limits,
      features: signupInvites.features,
      expiresAt: signupInvites.expiresAt,
      usedAt: signupInvites.usedAt,
      revokedAt: signupInvites.revokedAt,
      createdAt: signupInvites.createdAt,
      usedByEmail: user.email,
    })
    .from(signupInvites)
    .leftJoin(user, eq(user.id, signupInvites.usedByUserId))
    .orderBy(desc(signupInvites.createdAt));
  return rows.map((r) => ({
    ...r,
    status: inviteStatus(r),
    expiresAt: r.expiresAt.toISOString(),
    usedAt: r.usedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function shopsOverview() {
  const shops = await db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      limits: ownerEntitlements.limits,
      features: ownerEntitlements.features,
    })
    .from(organization)
    .leftJoin(member, eq(member.organizationId, organization.id))
    .leftJoin(user, eq(user.id, member.userId))
    .leftJoin(ownerEntitlements, eq(ownerEntitlements.userId, user.id))
    .where(eq(member.role, "owner"))
    .orderBy(desc(organization.createdAt));
  if (shops.length === 0) return [];
  const ids = shops.map((s) => s.id);
  const [productCounts, staffCounts, orderCounts] = await Promise.all([
    db
      .select({ id: products.organizationId, n: count() })
      .from(products)
      .where(inArray(products.organizationId, ids))
      .groupBy(products.organizationId),
    db
      .select({ id: staffCredentials.organizationId, n: count() })
      .from(staffCredentials)
      .where(inArray(staffCredentials.organizationId, ids))
      .groupBy(staffCredentials.organizationId),
    db
      .select({ id: orders.organizationId, n: count() })
      .from(orders)
      .where(inArray(orders.organizationId, ids))
      .groupBy(orders.organizationId),
  ]);
  const by = (rows: { id: string; n: number }[]) =>
    new Map(rows.map((r) => [r.id, r.n]));
  const [p, s, o] = [by(productCounts), by(staffCounts), by(orderCounts)];
  return shops.map((shop) => ({
    ...shop,
    createdAt: shop.createdAt.toISOString(),
    entitlements: normalizeEntitlements(
      shop.limits
        ? { limits: shop.limits, features: shop.features ?? undefined }
        : null,
    ),
    usage: {
      products: p.get(shop.id) ?? 0,
      staff: s.get(shop.id) ?? 0,
      orders: o.get(shop.id) ?? 0,
    },
  }));
}

export type InviteDTO = Awaited<ReturnType<typeof listInvites>>[number];
export type AdminShopDTO = Awaited<ReturnType<typeof shopsOverview>>[number];
