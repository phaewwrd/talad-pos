"use server";

import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import {
  account,
  ownerEntitlements as ownerEntitlementsTable,
  signupInvites,
  trustedDevices,
  user,
} from "@/db/schema";
import { createShopTx } from "@/features/shops/create-shop";
import { auth } from "@/lib/auth";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  hashToken,
  newDeviceToken,
} from "@/lib/devices";
import { AppError, runAction } from "@/lib/errors";
import { OWNER, requireMember } from "@/lib/permissions";
import { inviteStatus } from "./invites";
import { inviteSignupSchema, trustDeviceSchema } from "./schemas";

/**
 * Owner sign-up through an invite link. One transaction creates the user,
 * credential account, first shop + settings + owner membership, entitlements,
 * and marks the invite used; then signs the new owner in.
 */
export async function signupWithInvite(raw: unknown) {
  return runAction(async () => {
    const parsed = inviteSignupSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const input = parsed.data;
    const passwordHash = await hashPassword(input.password);

    await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(signupInvites)
        .where(eq(signupInvites.tokenHash, hashToken(input.token)))
        .for("update")
        .limit(1);
      if (!invite || inviteStatus(invite) !== "active") {
        throw new AppError("INVITE_INVALID");
      }
      if (invite.email && invite.email.toLowerCase() !== input.email) {
        throw new AppError("INVITE_EMAIL_MISMATCH");
      }

      const [existing] = await tx
        .select({ id: user.id })
        .from(user)
        .where(sql`lower(${user.email}) = ${input.email}`)
        .limit(1);
      if (existing) throw new AppError("EMAIL_TAKEN");

      const [owner] = await tx
        .insert(user)
        .values({ name: input.name, email: input.email, emailVerified: false })
        .returning({ id: user.id });
      await tx.insert(account).values({
        accountId: owner.id,
        providerId: "credential",
        userId: owner.id,
        password: passwordHash,
      });
      await createShopTx(tx, { ownerId: owner.id, name: input.shopName });
      await tx.insert(ownerEntitlementsTable).values({
        userId: owner.id,
        limits: invite.limits,
        features: invite.features,
        sourceInviteId: invite.id,
      });
      await tx
        .update(signupInvites)
        .set({ usedAt: new Date(), usedByUserId: owner.id })
        .where(
          and(eq(signupInvites.id, invite.id), isNull(signupInvites.usedAt)),
        );
    });

    await auth.api.signInEmail({
      body: { email: input.email, password: input.password },
      headers: await headers(),
    });
    return { ok: true as const };
  });
}

/** Owner marks the current device as a POS terminal for the active shop. */
export async function trustThisDevice(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireMember({ roles: OWNER });
    const parsed = trustDeviceSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");

    const { tokenHash, cookieValue } = newDeviceToken();
    const [device] = await db
      .insert(trustedDevices)
      .values({
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        tokenHash,
        createdBy: ctx.user.id,
        lastSeenAt: new Date(),
      })
      .returning({ id: trustedDevices.id });

    (await cookies()).set(DEVICE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
    return { id: device.id };
  });
}
