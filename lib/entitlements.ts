import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  type EntitlementFeatures,
  type EntitlementLimits,
  member,
  ownerEntitlements,
  products,
  staffCredentials,
} from "@/db/schema";
import { AppError } from "@/lib/errors";

export type Entitlements = {
  limits: EntitlementLimits;
  features: EntitlementFeatures;
};
export type FeatureKey = keyof EntitlementFeatures;

// TODO(decision): defaults for owners without an entitlements row (e.g. seeded
// or legacy accounts) — the most restrictive plan.
export const DEFAULT_ENTITLEMENTS: Entitlements = {
  limits: { maxShops: 1, maxStaffPerShop: 3, maxProducts: 100 },
  features: {
    promotions: false,
    costProfit: false,
    export: false,
    platformChannels: false,
    multiShop: false,
  },
};

export function normalizeEntitlements(
  row: Partial<Entitlements> | null | undefined,
): Entitlements {
  return {
    limits: { ...DEFAULT_ENTITLEMENTS.limits, ...row?.limits },
    features: { ...DEFAULT_ENTITLEMENTS.features, ...row?.features },
  };
}

/** Entitlements of the owner of `organizationId` (staff inherit them). */
export async function getOrganizationEntitlements(
  organizationId: string,
): Promise<Entitlements> {
  const [row] = await db
    .select({
      limits: ownerEntitlements.limits,
      features: ownerEntitlements.features,
    })
    .from(member)
    .innerJoin(ownerEntitlements, eq(ownerEntitlements.userId, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner")),
    )
    .limit(1);
  return normalizeEntitlements(row);
}

export async function getUserEntitlements(
  userId: string,
): Promise<Entitlements> {
  const [row] = await db
    .select({
      limits: ownerEntitlements.limits,
      features: ownerEntitlements.features,
    })
    .from(ownerEntitlements)
    .where(eq(ownerEntitlements.userId, userId))
    .limit(1);
  return normalizeEntitlements(row);
}

export function assertFeature(entitlements: Entitlements, feature: FeatureKey) {
  if (!entitlements.features[feature]) {
    throw new AppError("FEATURE_DISABLED", { feature });
  }
}

export async function assertCanCreateShop(userId: string) {
  const ent = await getUserEntitlements(userId);
  const [{ value }] = await db
    .select({ value: count() })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));
  const max = ent.features.multiShop ? ent.limits.maxShops : 1;
  if (value >= max)
    throw new AppError("LIMIT_REACHED", { limit: "maxShops", max });
}

export async function assertCanAddStaff(
  organizationId: string,
  ent: Entitlements,
) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(member)
    .innerJoin(staffCredentials, eq(staffCredentials.userId, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.role, ["manager", "cashier"]),
        eq(staffCredentials.isActive, true),
      ),
    );
  const max = ent.limits.maxStaffPerShop;
  if (value >= max)
    throw new AppError("LIMIT_REACHED", { limit: "maxStaffPerShop", max });
}

export async function assertCanCreateProduct(
  organizationId: string,
  ent: Entitlements,
) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.organizationId, organizationId));
  const max = ent.limits.maxProducts;
  if (value >= max)
    throw new AppError("LIMIT_REACHED", { limit: "maxProducts", max });
}
