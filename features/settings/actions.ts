"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  member,
  organization,
  session,
  shopSettings,
  staffCredentials,
  trustedDevices,
  user,
} from "@/db/schema";
import { createShopTx } from "@/features/shops/create-shop";
import { hashPin } from "@/lib/auth/pin-plugin";
import { assertCanAddStaff, assertCanCreateShop } from "@/lib/entitlements";
import { AppError, runAction } from "@/lib/errors";
import { OWNER, requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";
import {
  createShopSchema,
  createStaffSchema,
  resetPinSchema,
  shopSettingsSchema,
  taxSettingsSchema,
  updateStaffSchema,
} from "./schemas";

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

const owner = () => requireMember({ roles: OWNER });

// ---------- Shop & tax ----------

export async function saveShopSettings(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(shopSettingsSchema, raw);
    await db.transaction(async (tx) => {
      await tx
        .insert(shopSettings)
        .values({ organizationId: ctx.organizationId, ...input })
        .onConflictDoUpdate({
          target: shopSettings.organizationId,
          set: input,
        });
      // Keep the organization name and logo in sync for the shop switcher.
      await tx
        .update(organization)
        .set({ name: input.displayName, logo: input.logoUrl })
        .where(eq(organization.id, ctx.organizationId));
    });
    return { ok: true as const };
  });
}

export async function saveTaxSettings(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(taxSettingsSchema, raw);
    const [row] = await db
      .update(shopSettings)
      .set(input)
      .where(eq(shopSettings.organizationId, ctx.organizationId))
      .returning({ id: shopSettings.organizationId });
    if (!row) throw new AppError("NOT_FOUND");
    return { ok: true as const };
  });
}

// ---------- Staff ----------

async function assertStaffInOrg(organizationId: string, userId: string) {
  const [row] = await db
    .select({ role: member.role })
    .from(staffCredentials)
    .innerJoin(
      member,
      and(
        eq(member.userId, staffCredentials.userId),
        eq(member.organizationId, staffCredentials.organizationId),
      ),
    )
    .where(
      and(
        eq(staffCredentials.userId, userId),
        eq(staffCredentials.organizationId, organizationId),
      ),
    );
  if (!row) throw new AppError("NOT_FOUND");
}

export async function createStaff(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(createStaffSchema, raw);
    await assertCanAddStaff(ctx.organizationId, ctx.entitlements);
    const pinHash = await hashPin(input.pin);
    return db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      // TODO(decision): staff have no email login; Better Auth requires a unique
      // email, so a non-routable placeholder is used.
      await tx.insert(user).values({
        id,
        name: input.name,
        email: `staff-${id}@pin.talad.invalid`,
      });
      await tx.insert(member).values({
        organizationId: ctx.organizationId,
        userId: id,
        role: input.role,
      });
      await tx
        .insert(staffCredentials)
        .values({ userId: id, organizationId: ctx.organizationId, pinHash });
      return { id };
    });
  });
}

export async function resetStaffPin(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(resetPinSchema, raw);
    await assertStaffInOrg(ctx.organizationId, input.userId);
    await db
      .update(staffCredentials)
      .set({
        pinHash: await hashPin(input.pin),
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(staffCredentials.userId, input.userId));
    return { ok: true as const };
  });
}

export async function updateStaff(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(updateStaffSchema, raw);
    await assertStaffInOrg(ctx.organizationId, input.userId);
    if (input.isActive === true)
      await assertCanAddStaff(ctx.organizationId, ctx.entitlements);
    await db.transaction(async (tx) => {
      if (input.role) {
        await tx
          .update(member)
          .set({ role: input.role })
          .where(
            and(
              eq(member.userId, input.userId),
              eq(member.organizationId, ctx.organizationId),
            ),
          );
      }
      if (input.isActive !== undefined) {
        await tx
          .update(staffCredentials)
          .set({ isActive: input.isActive })
          .where(eq(staffCredentials.userId, input.userId));
        // Deactivation ends their current sessions immediately.
        if (!input.isActive) {
          await tx.delete(session).where(eq(session.userId, input.userId));
        }
      }
    });
    return { ok: true as const };
  });
}

// ---------- Devices ----------

export async function revokeDevice(id: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const deviceId = uuid.parse(id);
    const [row] = await db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.organizationId, ctx.organizationId),
          isNull(trustedDevices.revokedAt),
        ),
      )
      .returning({ id: trustedDevices.id });
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  });
}

// ---------- Shops ----------

export async function createShop(raw: unknown) {
  return runAction(async () => {
    const ctx = await owner();
    const input = parse(createShopSchema, raw);
    await assertCanCreateShop(ctx.user.id);
    return db.transaction((tx) =>
      createShopTx(tx, { ownerId: ctx.user.id, name: input.name }),
    );
  });
}
