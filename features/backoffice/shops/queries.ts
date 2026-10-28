import "server-only";
import { and, asc, desc, eq, isNull, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  member,
  organization,
  ownerEntitlements,
  platformAuditLogs,
  type ShopStatus,
  session,
  shopSettings,
  shopStatus,
  staffCredentials,
  trustedDevices,
  user,
} from "@/db/schema";
import {
  bangkokRange,
  likePattern,
  pageOffset,
} from "@/lib/backoffice/list-params";
import { iso, queryRows } from "@/lib/backoffice/sql";
import {
  DEFAULT_ENTITLEMENTS,
  normalizeEntitlements,
} from "@/lib/entitlements";
import { isMemberRole } from "@/lib/roles";
import type { ShopListParams } from "./schemas";

// Platform stats exclude soft-deleted orders and Cancelled orders.
// TODO(decision): GMV counts unpaid (but not cancelled) orders as well.

const D = DEFAULT_ENTITLEMENTS.limits;

/**
 * One row per shop with owner, status, limits, usage and 30-day sales.
 * Owners without an entitlements row get DEFAULT_ENTITLEMENTS (as the shop app).
 */
const shopBase = sql`
  WITH owners AS (
    SELECT DISTINCT ON (m.organization_id) m.organization_id, m.user_id
    FROM member m
    WHERE m.role = 'owner'
    ORDER BY m.organization_id, m.created_at
  ),
  base AS (
    SELECT
      o.id,
      coalesce(ss.display_name, o.name) AS name,
      o.created_at,
      u.id AS owner_id,
      u.email AS owner_email,
      u.name AS owner_name,
      coalesce(st.status, 'active') AS status,
      CASE WHEN oe.user_id IS NULL THEN ${D.maxStaffPerShop}::int
           ELSE (oe.limits->>'maxStaffPerShop')::int END AS max_staff,
      CASE WHEN oe.user_id IS NULL THEN ${D.maxProducts}::int
           ELSE (oe.limits->>'maxProducts')::int END AS max_products,
      (SELECT count(*)::int
         FROM staff_credentials sc
         JOIN member sm ON sm.user_id = sc.user_id
          AND sm.organization_id = sc.organization_id
          AND sm.role IN ('manager', 'cashier')
        WHERE sc.organization_id = o.id AND sc.is_active) AS staff_used,
      (SELECT count(*)::int FROM products p WHERE p.organization_id = o.id) AS products_used,
      agg.orders_30d,
      agg.gmv_30d,
      agg.last_order_at
    FROM organization o
    LEFT JOIN shop_settings ss ON ss.organization_id = o.id
    LEFT JOIN owners ow ON ow.organization_id = o.id
    LEFT JOIN "user" u ON u.id = ow.user_id
    LEFT JOIN owner_entitlements oe ON oe.user_id = u.id
    LEFT JOIN shop_status st ON st.organization_id = o.id
    LEFT JOIN LATERAL (
      SELECT
        (count(*) FILTER (WHERE od.created_at >= now() - interval '30 days'))::int AS orders_30d,
        coalesce(sum(od.total) FILTER (WHERE od.created_at >= now() - interval '30 days'), 0)::text AS gmv_30d,
        max(od.created_at) AS last_order_at
      FROM orders od
      WHERE od.organization_id = o.id
        AND od.deleted_at IS NULL
        AND od.status <> 'Cancelled'
    ) agg ON true
  ),
  shops AS (
    SELECT base.*,
      ((max_staff IS NOT NULL AND staff_used >= 0.8 * max_staff)
        OR (max_products IS NOT NULL AND products_used >= 0.8 * max_products)) AS near_limit
    FROM base
  )`;

type ShopRowRaw = {
  id: string;
  name: string;
  created_at: Date;
  owner_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  status: ShopStatus;
  max_staff: number | null;
  max_products: number | null;
  staff_used: number;
  products_used: number;
  orders_30d: number;
  gmv_30d: string;
  last_order_at: Date | null;
  near_limit: boolean;
  total_count: number;
};

function toShopRow(r: ShopRowRaw) {
  return {
    id: r.id,
    name: r.name,
    createdAt: iso(r.created_at) as string,
    owner: r.owner_id
      ? { id: r.owner_id, email: r.owner_email ?? "", name: r.owner_name ?? "" }
      : null,
    status: r.status,
    staff: { used: r.staff_used, limit: r.max_staff },
    products: { used: r.products_used, limit: r.max_products },
    orders30d: r.orders_30d,
    gmv30d: r.gmv_30d,
    lastActivityAt: iso(r.last_order_at),
    nearLimit: r.near_limit,
  };
}
export type ShopRowDTO = ReturnType<typeof toShopRow>;

const SORTS = {
  name: sql`lower(name)`,
  ownerEmail: sql`owner_email`,
  status: sql`status`,
  staff: sql`staff_used`,
  products: sql`products_used`,
  orders30d: sql`orders_30d`,
  gmv30d: sql`gmv_30d::numeric`,
  createdAt: sql`created_at`,
  lastActivityAt: sql`last_order_at`,
} as const;

function shopWhere(p: ShopListParams) {
  const parts = [sql`true`];
  if (p.status) parts.push(sql`status = ${p.status}`);
  if (p.nearLimit) parts.push(sql`near_limit`);
  if (p.ownerId) parts.push(sql`owner_id = ${p.ownerId}`);
  const { start, end } = bangkokRange(p.from, p.to);
  if (start) parts.push(sql`created_at >= ${start}`);
  if (end) parts.push(sql`created_at < ${end}`);
  if (p.q) {
    const pattern = likePattern(p.q);
    parts.push(sql`(name ILIKE ${pattern} OR owner_email ILIKE ${pattern})`);
  }
  return sql.join(parts, sql` AND `);
}

function shopOrder(p: ShopListParams) {
  const col = SORTS[p.sort ?? "createdAt"];
  return p.dir === "asc"
    ? sql`${col} ASC NULLS LAST, id`
    : sql`${col} DESC NULLS LAST, id`;
}

export async function listShops(p: ShopListParams) {
  const rows = await queryRows<ShopRowRaw>(sql`
    ${shopBase}
    SELECT shops.*, count(*) OVER ()::int AS total_count
    FROM shops
    WHERE ${shopWhere(p)}
    ORDER BY ${shopOrder(p)}
    LIMIT ${p.pageSize} OFFSET ${pageOffset(p)}`);
  return { rows: rows.map(toShopRow), total: rows[0]?.total_count ?? 0 };
}

/** All matching shops for CSV export (capped). */
export async function exportShops(p: ShopListParams) {
  const rows = await queryRows<ShopRowRaw>(sql`
    ${shopBase}
    SELECT shops.*, 0 AS total_count
    FROM shops
    WHERE ${shopWhere(p)}
    ORDER BY ${shopOrder(p)}
    LIMIT 10000`);
  return rows.map(toShopRow);
}

/** A single shop row (same metrics as the list). */
export async function getShopRow(id: string) {
  const [row] = await queryRows<ShopRowRaw>(sql`
    ${shopBase}
    SELECT shops.*, 1 AS total_count FROM shops WHERE id = ${id}`);
  return row ? toShopRow(row) : null;
}

export async function getShopDetail(id: string) {
  const shop = await getShopRow(id);
  if (!shop) return null;

  const [[settings], [statusRow], ownerInfo, sales] = await Promise.all([
    db
      .select({
        displayName: shopSettings.displayName,
        logoUrl: shopSettings.logoUrl,
        phone: shopSettings.phone,
        address: shopSettings.address,
        taxId: shopSettings.taxId,
      })
      .from(shopSettings)
      .where(eq(shopSettings.organizationId, id)),
    db
      .select({
        status: shopStatus.status,
        reason: shopStatus.reason,
        changedAt: shopStatus.changedAt,
        changedByName: user.name,
      })
      .from(shopStatus)
      .leftJoin(user, eq(user.id, shopStatus.changedBy))
      .where(eq(shopStatus.organizationId, id)),
    shop.owner ? getOwnerCard(shop.owner.id, id) : Promise.resolve(null),
    shopSales30d(id),
  ]);

  return {
    ...shop,
    settings: settings ?? null,
    statusInfo: statusRow
      ? {
          ...statusRow,
          changedAt: statusRow.changedAt.toISOString(),
        }
      : null,
    ownerInfo,
    sales,
  };
}
export type ShopDetailDTO = NonNullable<
  Awaited<ReturnType<typeof getShopDetail>>
>;

async function getOwnerCard(ownerId: string, currentShopId: string) {
  const [[owner], [ent], shops, [lastLogin]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        banned: user.banned,
        banReason: user.banReason,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, ownerId)),
    db
      .select({
        limits: ownerEntitlements.limits,
        features: ownerEntitlements.features,
        updatedAt: ownerEntitlements.updatedAt,
      })
      .from(ownerEntitlements)
      .where(eq(ownerEntitlements.userId, ownerId)),
    db
      .select({
        id: organization.id,
        name: sql<string>`coalesce(${shopSettings.displayName}, ${organization.name})`,
        status: sql<ShopStatus>`coalesce(${shopStatus.status}, 'active')`,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .leftJoin(shopSettings, eq(shopSettings.organizationId, organization.id))
      .leftJoin(shopStatus, eq(shopStatus.organizationId, organization.id))
      .where(and(eq(member.userId, ownerId), eq(member.role, "owner")))
      .orderBy(asc(member.createdAt)),
    // TODO(decision): "last login" = newest session; sessions are deleted on logout.
    db
      .select({ at: max(session.createdAt) })
      .from(session)
      .where(and(eq(session.userId, ownerId), isNull(session.impersonatedBy))),
  ]);
  if (!owner) return null;
  return {
    ...owner,
    banned: !!owner.banned,
    createdAt: owner.createdAt.toISOString(),
    lastLoginAt: iso(lastLogin?.at ?? null),
    entitlements: normalizeEntitlements(ent ?? null),
    hasEntitlementsRow: !!ent,
    shopsOwned: shops.length,
    otherShops: shops.filter((s) => s.id !== currentShopId),
  };
}

async function shopSales30d(id: string) {
  const [row] = await queryRows<{
    orders: number;
    gmv: string;
    avg_ticket: string;
    paid_orders: number;
  }>(sql`
    SELECT count(*)::int AS orders,
           coalesce(sum(total), 0)::text AS gmv,
           coalesce(round(avg(total), 2), 0)::text AS avg_ticket,
           (count(*) FILTER (WHERE payment_type = 'Paid'))::int AS paid_orders
    FROM orders
    WHERE organization_id = ${id}
      AND deleted_at IS NULL
      AND status <> 'Cancelled'
      AND created_at >= now() - interval '30 days'`);
  return {
    orders: row?.orders ?? 0,
    gmv: row?.gmv ?? "0",
    avgTicket: row?.avg_ticket ?? "0",
    paidOrders: row?.paid_orders ?? 0,
  };
}

/** Owner, managers, cashiers — never PIN hashes. */
export async function listShopMembers(id: string) {
  const lastSeen = db
    .select({ userId: session.userId, at: max(session.updatedAt).as("at") })
    .from(session)
    .groupBy(session.userId)
    .as("last_seen");
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: member.role,
      banned: user.banned,
      staffActive: staffCredentials.isActive,
      lockedUntil: staffCredentials.lockedUntil,
      joinedAt: member.createdAt,
      lastLoginAt: lastSeen.at,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      staffCredentials,
      and(
        eq(staffCredentials.userId, member.userId),
        eq(staffCredentials.organizationId, member.organizationId),
      ),
    )
    .leftJoin(lastSeen, eq(lastSeen.userId, user.id))
    .where(eq(member.organizationId, id))
    .orderBy(asc(member.createdAt));
  const rank = { owner: 0, manager: 1, cashier: 2 } as const;
  return rows
    .map((r) => {
      const role =
        r.role
          .split(",")
          .map((x) => x.trim())
          .filter(isMemberRole)
          .sort((a, b) => rank[a] - rank[b])[0] ?? "cashier";
      return {
        userId: r.userId,
        name: r.name,
        // Staff accounts use placeholder emails; only show the owner's.
        email: role === "owner" ? r.email : null,
        role,
        active: !r.banned && r.staffActive !== false,
        locked: !!r.lockedUntil && r.lockedUntil > new Date(),
        joinedAt: r.joinedAt.toISOString(),
        lastLoginAt: iso(r.lastLoginAt),
      };
    })
    .sort((a, b) => rank[a.role] - rank[b.role]);
}
export type ShopMemberDTO = Awaited<ReturnType<typeof listShopMembers>>[number];

export async function listShopDevices(id: string) {
  const rows = await db
    .select({
      id: trustedDevices.id,
      name: trustedDevices.name,
      createdAt: trustedDevices.createdAt,
      lastSeenAt: trustedDevices.lastSeenAt,
      revokedAt: trustedDevices.revokedAt,
      createdByName: user.name,
    })
    .from(trustedDevices)
    .leftJoin(user, eq(user.id, trustedDevices.createdBy))
    .where(eq(trustedDevices.organizationId, id))
    .orderBy(asc(trustedDevices.revokedAt), desc(trustedDevices.lastSeenAt));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastSeenAt: iso(r.lastSeenAt),
    revokedAt: iso(r.revokedAt),
  }));
}
export type ShopDeviceDTO = Awaited<ReturnType<typeof listShopDevices>>[number];

/** Audit entries about this shop and its owner, newest first. */
export async function listShopActivity(id: string, ownerId: string | null) {
  const where = ownerId
    ? or(
        and(
          eq(platformAuditLogs.targetType, "shop"),
          eq(platformAuditLogs.targetId, id),
        ),
        and(
          eq(platformAuditLogs.targetType, "user"),
          eq(platformAuditLogs.targetId, ownerId),
        ),
      )
    : and(
        eq(platformAuditLogs.targetType, "shop"),
        eq(platformAuditLogs.targetId, id),
      );
  const rows = await db
    .select({
      id: platformAuditLogs.id,
      actorLabel: platformAuditLogs.actorLabel,
      action: platformAuditLogs.action,
      targetType: platformAuditLogs.targetType,
      reason: platformAuditLogs.reason,
      before: platformAuditLogs.before,
      after: platformAuditLogs.after,
      createdAt: platformAuditLogs.createdAt,
    })
    .from(platformAuditLogs)
    .where(where)
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
export type ShopActivityDTO = Awaited<
  ReturnType<typeof listShopActivity>
>[number];

/** The shop's owner id, or null. */
export async function shopOwnerId(id: string) {
  const [row] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, id), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return row?.userId ?? null;
}
