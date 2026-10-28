import "server-only";
import { sql } from "drizzle-orm";
import type { ShopStatus } from "@/db/schema";
import type { InviteStatus } from "@/lib/backoffice/invite-status";
import { iso, queryRows } from "@/lib/backoffice/sql";
import { inviteStatusSql } from "../invites/queries";
import { listShops } from "../shops/queries";

// Platform KPIs. Every aggregate is computed in SQL; day / month buckets are
// Asia/Bangkok. Orders exclude soft-deleted and Cancelled ones.
// organization.created_at is `timestamp` (UTC, no zone) → AT TIME ZONE 'UTC'.

const BKK = sql.raw(`'Asia/Bangkok'`);
const ORG_CREATED = sql.raw(`(o.created_at AT TIME ZONE 'UTC')`);
const LIVE_ORDER = sql.raw(
  `od.deleted_at IS NULL AND od.status <> 'Cancelled'`,
);

export async function getDashboard() {
  const [
    shopCounts,
    [newShops],
    inviteCounts,
    [sales],
    daily,
    nearLimit,
    expiring,
    recent,
  ] = await Promise.all([
    queryRows<{ status: ShopStatus; n: number }>(sql`
      SELECT coalesce(st.status, 'active') AS status, count(*)::int AS n
      FROM organization o
      LEFT JOIN shop_status st ON st.organization_id = o.id
      GROUP BY 1`),

    queryRows<{ this_month: number; last_month: number }>(sql`
      WITH m AS (
        SELECT date_trunc('month', now() AT TIME ZONE ${BKK}) AS this_start
      )
      SELECT
        (count(*) FILTER (
          WHERE (${ORG_CREATED} AT TIME ZONE ${BKK}) >= m.this_start))::int AS this_month,
        (count(*) FILTER (
          WHERE (${ORG_CREATED} AT TIME ZONE ${BKK}) >= m.this_start - interval '1 month'
            AND (${ORG_CREATED} AT TIME ZONE ${BKK}) < m.this_start))::int AS last_month
      FROM organization o, m
      GROUP BY m.this_start`),

    queryRows<{ status: InviteStatus; n: number }>(sql`
      SELECT ${inviteStatusSql} AS status, count(*)::int AS n
      FROM signup_invites
      GROUP BY 1`),

    queryRows<{
      orders_today: number;
      gmv_today: string;
      orders_30d: number;
      gmv_30d: string;
    }>(sql`
      WITH d AS (SELECT (now() AT TIME ZONE ${BKK})::date AS today)
      SELECT
        (count(*) FILTER (WHERE (od.created_at AT TIME ZONE ${BKK})::date = d.today))::int AS orders_today,
        coalesce(sum(od.total) FILTER (
          WHERE (od.created_at AT TIME ZONE ${BKK})::date = d.today), 0)::text AS gmv_today,
        count(*)::int AS orders_30d,
        coalesce(sum(od.total), 0)::text AS gmv_30d
      FROM orders od, d
      WHERE ${LIVE_ORDER}
        AND (od.created_at AT TIME ZONE ${BKK})::date > d.today - 30
      GROUP BY d.today`),

    // 30 Bangkok days ending today, gaps filled with zero.
    queryRows<{
      day: string;
      gmv: string;
      orders: number;
      new_shops: number;
    }>(sql`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE ${BKK})::date - 29,
          (now() AT TIME ZONE ${BKK})::date,
          interval '1 day')::date AS day
      ),
      sales AS (
        SELECT (od.created_at AT TIME ZONE ${BKK})::date AS day,
               sum(od.total) AS gmv, count(*) AS orders
        FROM orders od
        WHERE ${LIVE_ORDER}
          AND od.created_at >= now() - interval '31 days'
        GROUP BY 1
      ),
      shops AS (
        SELECT (${ORG_CREATED} AT TIME ZONE ${BKK})::date AS day, count(*) AS n
        FROM organization o
        WHERE ${ORG_CREATED} >= now() - interval '31 days'
        GROUP BY 1
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
             coalesce(sales.gmv, 0)::text AS gmv,
             coalesce(sales.orders, 0)::int AS orders,
             coalesce(shops.n, 0)::int AS new_shops
      FROM days
      LEFT JOIN sales ON sales.day = days.day
      LEFT JOIN shops ON shops.day = days.day
      ORDER BY days.day`),

    listShops({
      page: 1,
      pageSize: 20,
      nearLimit: true,
      sort: "lastActivityAt",
      dir: "desc",
    }),

    queryRows<{
      id: string;
      label: string;
      email: string | null;
      expires_at: string;
      sent_at: string | null;
    }>(sql`
      SELECT id, label, email, expires_at, sent_at
      FROM signup_invites
      WHERE used_at IS NULL AND revoked_at IS NULL
        AND expires_at >= now() AND expires_at < now() + interval '48 hours'
      ORDER BY expires_at
      LIMIT 20`),

    listShops({
      page: 1,
      pageSize: 10,
      sort: "lastActivityAt",
      dir: "desc",
    }),
  ]);

  const byStatus = <K extends string>(rows: { status: K; n: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
      Record<K, number>
    >;
  const shops = byStatus(shopCounts);
  const invites = byStatus(inviteCounts);

  return {
    shops: {
      active: shops.active ?? 0,
      suspended: shops.suspended ?? 0,
      closed: shops.closed ?? 0,
    },
    newShops: {
      thisMonth: newShops?.this_month ?? 0,
      lastMonth: newShops?.last_month ?? 0,
    },
    invites: {
      draft: invites.draft ?? 0,
      sent: invites.sent ?? 0,
      used: invites.used ?? 0,
      expired: invites.expired ?? 0,
      revoked: invites.revoked ?? 0,
    },
    sales: {
      ordersToday: sales?.orders_today ?? 0,
      gmvToday: sales?.gmv_today ?? "0",
      orders30d: sales?.orders_30d ?? 0,
      gmv30d: sales?.gmv_30d ?? "0",
    },
    daily: daily.map((d) => ({
      day: d.day,
      gmv: d.gmv,
      orders: d.orders,
      newShops: d.new_shops,
    })),
    nearLimit: nearLimit.rows,
    expiringInvites: expiring.map((i) => ({
      id: i.id,
      label: i.label,
      email: i.email,
      expiresAt: iso(i.expires_at) as string,
      sent: i.sent_at !== null,
    })),
    recentShops: recent.rows.filter((s) => s.lastActivityAt !== null),
  };
}
export type DashboardDTO = Awaited<ReturnType<typeof getDashboard>>;
