import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { member, shopStatus, staffCredentials } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  assertFeature,
  type Entitlements,
  type FeatureKey,
  getOrganizationEntitlements,
} from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import { isMemberRole, type MemberRole } from "@/lib/roles";

export type MemberContext = {
  user: { id: string; name: string; email: string; image: string | null };
  organizationId: string;
  role: MemberRole;
  entitlements: Entitlements;
  isPinSession: boolean;
};

// Owner > manager > cashier. Useful for "at least" checks.
export const ROLE_RANK: Record<MemberRole, number> = {
  cashier: 0,
  manager: 1,
  owner: 2,
};

export const getAuthSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * Resolve the signed-in member of the session's **active organization**.
 * The organization id always comes from the server-side session, never from
 * the client. Cached per request.
 */
const loadMember = cache(async (): Promise<MemberContext> => {
  const session = await getAuthSession();
  if (!session) throw new AppError("UNAUTHORIZED");

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw new AppError("NO_ACTIVE_SHOP");

  const [row] = await db
    .select({
      role: member.role,
      staffActive: staffCredentials.isActive,
      shopStatus: shopStatus.status,
    })
    .from(member)
    .leftJoin(
      staffCredentials,
      and(
        eq(staffCredentials.userId, member.userId),
        eq(staffCredentials.organizationId, member.organizationId),
      ),
    )
    .leftJoin(shopStatus, eq(shopStatus.organizationId, member.organizationId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, session.user.id),
      ),
    )
    .limit(1);

  // A comma-separated multi-role string is allowed by Better Auth; take the highest.
  const role = row?.role
    .split(",")
    .map((r) => r.trim())
    .filter(isMemberRole)
    .sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
  if (!row || !role) throw new AppError("FORBIDDEN");
  if (row.staffActive === false) throw new AppError("STAFF_INACTIVE");
  // Set by the Backoffice; blocks every page, action and route immediately.
  if (row.shopStatus === "suspended") throw new AppError("SHOP_SUSPENDED");
  if (row.shopStatus === "closed") throw new AppError("SHOP_CLOSED");

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    organizationId,
    role,
    entitlements: await getOrganizationEntitlements(organizationId),
    isPinSession: row.staffActive !== null,
  };
});

export async function requireMember(
  options: { roles?: readonly MemberRole[]; feature?: FeatureKey } = {},
): Promise<MemberContext> {
  const ctx = await loadMember();
  if (options.roles && !options.roles.includes(ctx.role)) {
    throw new AppError("FORBIDDEN");
  }
  if (options.feature) assertFeature(ctx.entitlements, options.feature);
  return ctx;
}

export const OWNER = ["owner"] as const;
export const OWNER_MANAGER = ["owner", "manager"] as const;
export const ANY_MEMBER = ["owner", "manager", "cashier"] as const;
