"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/backoffice/audit";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError, runAction } from "@/lib/errors";
import { requireShopOwner } from "./guards";
import {
  banOwnerSchema,
  impersonateOwnerSchema,
  passwordResetSchema,
  unbanOwnerSchema,
} from "./schemas";

/** Ban an owner and revoke all of their sessions. */
export async function banOwner(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("owner.ban") });
    const parsed = banOwnerSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const owner = await requireShopOwner(parsed.data.userId);
    if (owner.banned) throw new AppError("INVALID_STATE");
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          banned: true,
          banReason: parsed.data.reason,
          banExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, owner.id));
      await tx.delete(session).where(eq(session.userId, owner.id));
      await writeAudit(tx, {
        ...ctx.audit,
        action: "owner.ban",
        targetType: "user",
        targetId: owner.id,
        reason: parsed.data.reason,
        before: { banned: false },
        after: { banned: true, sessionsRevoked: true },
      });
    });
    return { userId: owner.id };
  });
}

export async function unbanOwner(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("owner.ban") });
    const parsed = unbanOwnerSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const owner = await requireShopOwner(parsed.data.userId);
    if (!owner.banned) throw new AppError("INVALID_STATE");
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          banned: false,
          banReason: null,
          banExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, owner.id));
      await writeAudit(tx, {
        ...ctx.audit,
        action: "owner.unban",
        targetType: "user",
        targetId: owner.id,
        reason: parsed.data.reason,
        before: { banned: true, banReason: owner.banReason },
        after: { banned: false },
      });
    });
    return { userId: owner.id };
  });
}

/** Better Auth's normal reset flow: the owner gets a reset link by email. */
export async function sendOwnerPasswordReset(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({
      roles: rolesFor("owner.passwordReset"),
    });
    const parsed = passwordResetSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const owner = await requireShopOwner(parsed.data.userId);
    try {
      await auth.api.requestPasswordReset({
        body: {
          email: owner.email,
          redirectTo: `/${parsed.data.locale}/reset-password`,
        },
      });
    } catch (err) {
      throw new AppError("EMAIL_SEND_FAILED", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    await db.transaction(async (tx) => {
      await writeAudit(tx, {
        ...ctx.audit,
        action: "owner.password_reset",
        targetType: "user",
        targetId: owner.id,
        after: { email: owner.email },
      });
    });
    return { email: owner.email };
  });
}

/**
 * Sign in as the owner (Better Auth impersonateUser) for at most 30 minutes.
 * The backoffice session is parked by Better Auth and restored on "Stop".
 */
export async function impersonateOwner(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({
      roles: rolesFor("owner.impersonate"),
    });
    const parsed = impersonateOwnerSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { userId, organizationId, reason } = parsed.data;
    const owner = await requireShopOwner(userId, organizationId);
    if (owner.banned) throw new AppError("INVALID_STATE");

    const result = await auth.api.impersonateUser({
      body: { userId: owner.id },
      headers: await headers(),
    });
    await db.transaction(async (tx) => {
      // Open the shop the admin chose, not just the owner's first one.
      await tx
        .update(session)
        .set({ activeOrganizationId: organizationId })
        .where(eq(session.id, result.session.id));
      await writeAudit(tx, {
        ...ctx.audit,
        action: "user.impersonate.start",
        targetType: "user",
        targetId: owner.id,
        reason,
        after: {
          organizationId,
          impersonationSessionId: result.session.id,
          expiresAt: new Date(result.session.expiresAt).toISOString(),
        },
      });
    });
    return { redirectTo: "/pos" };
  });
}
