"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  organization,
  ownerEntitlements,
  type ShopStatus,
  shopSettings,
  shopStatus,
  trustedDevices,
} from "@/db/schema";
import { type AuditAction, writeAudit } from "@/lib/backoffice/audit";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { normalizeEntitlements } from "@/lib/entitlements";
import { AppError, runAction } from "@/lib/errors";
import { shopOwnerId } from "./queries";
import {
  changeShopStatusSchema,
  revokeDeviceSchema,
  updateEntitlementsSchema,
} from "./schemas";

/**
 * Change the owner's plan (limits + features). Applies to every shop the owner
 * has. Lowering a limit below current usage keeps existing data; the shop app
 * just refuses to create more.
 */
export async function updateOwnerEntitlements(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({
      roles: rolesFor("entitlement.edit"),
    });
    const parsed = updateEntitlementsSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { organizationId, limits, features, reason } = parsed.data;
    const ownerId = await shopOwnerId(organizationId);
    if (!ownerId) throw new AppError("NOT_FOUND");

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(ownerEntitlements)
        .where(eq(ownerEntitlements.userId, ownerId))
        .for("update");
      const before = normalizeEntitlements(existing ?? null);
      await tx
        .insert(ownerEntitlements)
        .values({ userId: ownerId, limits, features, updatedBy: ctx.user.id })
        .onConflictDoUpdate({
          target: ownerEntitlements.userId,
          set: {
            limits,
            features,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          },
        });
      await writeAudit(tx, {
        ...ctx.audit,
        action: "entitlement.update",
        targetType: "user",
        targetId: ownerId,
        reason,
        before: { ...before, organizationId, hadRow: !!existing },
        after: { limits, features, organizationId },
      });
    });
    return { ownerId };
  });
}

const STATUS_ACTION: Record<ShopStatus, AuditAction> = {
  active: "shop.reactivate",
  suspended: "shop.suspend",
  closed: "shop.close",
};

// TODO(decision): a closed shop can be reactivated by a super_admin.
const ALLOWED_FROM: Record<ShopStatus, ShopStatus[]> = {
  suspended: ["active"],
  closed: ["active", "suspended"],
  active: ["suspended", "closed"],
};

/** Suspend / reactivate / close. Takes effect on the shop's next request. */
export async function changeShopStatus(raw: unknown) {
  return runAction(async () => {
    const parsed = changeShopStatusSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const input = parsed.data;
    const ctx = await requireBackoffice({
      roles: rolesFor(input.status === "closed" ? "shop.close" : "shop.status"),
    });

    await db.transaction(async (tx) => {
      const [shop] = await tx
        .select({
          id: organization.id,
          name: sql<string>`coalesce(${shopSettings.displayName}, ${organization.name})`,
        })
        .from(organization)
        .leftJoin(
          shopSettings,
          eq(shopSettings.organizationId, organization.id),
        )
        .where(eq(organization.id, input.organizationId));
      if (!shop) throw new AppError("NOT_FOUND");
      if (input.status === "closed" && input.confirmName !== shop.name) {
        throw new AppError("CONFIRMATION_MISMATCH");
      }

      const [current] = await tx
        .select()
        .from(shopStatus)
        .where(eq(shopStatus.organizationId, shop.id))
        .for("update");
      const from: ShopStatus = current?.status ?? "active";
      if (!ALLOWED_FROM[from].includes(input.status)) {
        throw new AppError("INVALID_STATUS_TRANSITION");
      }

      const values = {
        status: input.status,
        reason: input.reason,
        changedBy: ctx.user.id,
        changedAt: new Date(),
      };
      await tx
        .insert(shopStatus)
        .values({ organizationId: shop.id, ...values })
        .onConflictDoUpdate({ target: shopStatus.organizationId, set: values });
      await writeAudit(tx, {
        ...ctx.audit,
        action: STATUS_ACTION[input.status],
        targetType: "shop",
        targetId: shop.id,
        reason: input.reason,
        before: { status: from },
        after: { status: input.status },
      });
    });
    return { status: input.status };
  });
}

export async function revokeShopDevice(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({
      roles: rolesFor("shop.devices.revoke"),
    });
    const parsed = revokeDeviceSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { organizationId, deviceId, reason } = parsed.data;
    await db.transaction(async (tx) => {
      const [device] = await tx
        .update(trustedDevices)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(trustedDevices.id, deviceId),
            eq(trustedDevices.organizationId, organizationId),
            isNull(trustedDevices.revokedAt),
          ),
        )
        .returning({ id: trustedDevices.id, name: trustedDevices.name });
      if (!device) throw new AppError("NOT_FOUND");
      await writeAudit(tx, {
        ...ctx.audit,
        action: "shop.device_revoke",
        targetType: "shop",
        targetId: organizationId,
        reason,
        before: { deviceId, name: device.name, revoked: false },
        after: { deviceId, name: device.name, revoked: true },
      });
    });
    return { deviceId };
  });
}
