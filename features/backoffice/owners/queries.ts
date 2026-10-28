import "server-only";
import { sql } from "drizzle-orm";
import type { EntitlementFeatures, EntitlementLimits } from "@/db/schema";
import { likePattern, pageOffset } from "@/lib/backoffice/list-params";
import { BACKOFFICE_ROLES } from "@/lib/backoffice/roles";
import { iso, queryRows } from "@/lib/backoffice/sql";
import { normalizeEntitlements } from "@/lib/entitlements";
import type { OwnerListParams } from "./schemas";

type OwnerRaw = {
  id: string;
  email: string;
  name: string;
  banned: boolean | null;
  ban_reason: string | null;
  created_at: string;
  shops: number;
  limits: EntitlementLimits | null;
  features: EntitlementFeatures | null;
  last_login_at: string | null;
  total_count: number;
};

const SORTS = {
  email: sql`lower(u.email)`,
  name: sql`lower(u.name)`,
  shops: sql`o.shops`,
  createdAt: sql`created_at`,
  lastLoginAt: sql`last_login_at`,
} as const;

/** Users who own at least one shop (never backoffice accounts). */
export async function listOwners(p: OwnerListParams) {
  const where = [
    sql`(u.role IS NULL OR u.role NOT IN (${sql.join(
      BACKOFFICE_ROLES.map((r) => sql`${r}`),
      sql`, `,
    )}))`,
  ];
  if (p.banned !== undefined)
    where.push(sql`coalesce(u.banned, false) = ${p.banned}`);
  if (p.q) {
    const pattern = likePattern(p.q);
    where.push(sql`(u.email ILIKE ${pattern} OR u.name ILIKE ${pattern})`);
  }
  const col = SORTS[p.sort ?? "createdAt"];
  const order =
    p.dir === "asc" ? sql`${col} ASC NULLS LAST` : sql`${col} DESC NULLS LAST`;

  const rows = await queryRows<OwnerRaw>(sql`
    WITH o AS (
      SELECT user_id, count(*)::int AS shops
      FROM member WHERE role = 'owner' GROUP BY user_id
    )
    SELECT u.id, u.email, u.name, u.banned, u.ban_reason,
      u.created_at AT TIME ZONE 'UTC' AS created_at, o.shops,
      oe.limits, oe.features,
      -- TODO(decision): sessions are deleted on logout; this is the newest live one.
      (SELECT max(s.created_at) AT TIME ZONE 'UTC' FROM session s
        WHERE s.user_id = u.id AND s.impersonated_by IS NULL) AS last_login_at,
      count(*) OVER ()::int AS total_count
    FROM o
    JOIN "user" u ON u.id = o.user_id
    LEFT JOIN owner_entitlements oe ON oe.user_id = u.id
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${order}, u.id
    LIMIT ${p.pageSize} OFFSET ${pageOffset(p)}`);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      banned: !!r.banned,
      banReason: r.ban_reason,
      shops: r.shops,
      entitlements: normalizeEntitlements(
        r.limits && r.features
          ? { limits: r.limits, features: r.features }
          : null,
      ),
      createdAt: iso(r.created_at) as string,
      lastLoginAt: iso(r.last_login_at),
    })),
    total: rows[0]?.total_count ?? 0,
  };
}
export type OwnerDTO = Awaited<ReturnType<typeof listOwners>>["rows"][number];
