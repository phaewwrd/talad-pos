"use server";

import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { inviteEmailLogs, signupInvites } from "@/db/schema";
import { writeAudit } from "@/lib/backoffice/audit";
import { requireBackoffice } from "@/lib/backoffice/guard";
import {
  getInviteStatus,
  isInviteEditable,
  isInviteUsable,
} from "@/lib/backoffice/invite-status";
import {
  buildInviteUrl,
  generateInviteToken,
} from "@/lib/backoffice/invite-token";
import { rolesFor } from "@/lib/backoffice/permissions";
import { sendInviteEmail } from "@/lib/email/send";
import { AppError, runAction } from "@/lib/errors";
import { addDays } from "@/lib/time";
import {
  createInviteSchema,
  INVITE_MAX_SENDS_PER_DAY,
  inviteIdSchema,
  revokeInviteSchema,
  updateInviteSchema,
} from "./schemas";

/** Audit snapshot of an invite: no token hash, ever. */
function snapshot(i: typeof signupInvites.$inferSelect) {
  return {
    label: i.label,
    email: i.email,
    lockToEmail: i.lockToEmail,
    emailLocale: i.emailLocale,
    limits: i.limits,
    features: i.features,
    expiresAt: i.expiresAt.toISOString(),
    status: getInviteStatus(i),
  };
}

async function lockInvite(tx: Tx, id: string) {
  const [invite] = await tx
    .select()
    .from(signupInvites)
    .where(eq(signupInvites.id, id))
    .for("update")
    .limit(1);
  if (!invite) throw new AppError("NOT_FOUND");
  return invite;
}

/** Emails sent (or in flight) for this invite in the last 24 hours. */
async function assertSendQuota(inviteId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(inviteEmailLogs)
    .where(
      and(
        eq(inviteEmailLogs.inviteId, inviteId),
        inArray(inviteEmailLogs.status, ["queued", "sent"]),
        gte(inviteEmailLogs.createdAt, addDays(new Date(), -1)),
      ),
    );
  if (n >= INVITE_MAX_SENDS_PER_DAY) {
    throw new AppError("SEND_LIMIT_REACHED", { max: INVITE_MAX_SENDS_PER_DAY });
  }
}

/**
 * Deliver the invite email after the token change has committed. Delivery
 * failures are logged (invite_email_logs) and reported as EMAIL_SEND_FAILED;
 * the invite stays retryable.
 */
async function deliver(
  invite: typeof signupInvites.$inferSelect,
  url: string,
  sentBy: string,
) {
  if (!invite.email) throw new AppError("EMAIL_REQUIRED");
  const r = await sendInviteEmail({
    inviteId: invite.id,
    to: invite.email,
    locale: invite.emailLocale,
    url,
    label: invite.label,
    limits: invite.limits,
    features: invite.features,
    expiresAt: invite.expiresAt,
    sentBy,
  });
  if (!r.ok) throw new AppError("EMAIL_SEND_FAILED", { error: r.error });
}

/**
 * Create an invite and either email it or return its link. The raw token
 * exists only in this response / the email; the DB stores its SHA-256.
 */
export async function createInvite(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("invite.create") });
    const parsed = createInviteSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { delivery, expiresInDays, ...input } = parsed.data;

    const { token, tokenHash } = generateInviteToken();
    const invite = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(signupInvites)
        .values({
          ...input,
          tokenHash,
          expiresAt: addDays(new Date(), expiresInDays),
          createdBy: ctx.user.id,
        })
        .returning();
      await writeAudit(tx, {
        ...ctx.audit,
        action: "invite.create",
        targetType: "invite",
        targetId: row.id,
        after: { ...snapshot(row), delivery },
      });
      return row;
    });

    const url = buildInviteUrl(token, invite.emailLocale);
    if (delivery === "email") {
      await deliver(invite, url, ctx.user.id);
      return { id: invite.id, url: null };
    }
    return { id: invite.id, url };
  });
}

/**
 * Give the invite a fresh token (the previous link stops working at once) and
 * record why. Used by both "send / resend" and "copy link".
 */
async function rotate(
  inviteId: string,
  action: "invite.send" | "invite.link_copy",
  ctx: Awaited<ReturnType<typeof requireBackoffice>>,
) {
  const { token, tokenHash } = generateInviteToken();
  const invite = await db.transaction(async (tx) => {
    const before = await lockInvite(tx, inviteId);
    if (!isInviteUsable(getInviteStatus(before))) {
      throw new AppError("INVITE_INVALID");
    }
    if (action === "invite.send" && !before.email) {
      throw new AppError("EMAIL_REQUIRED");
    }
    const [after] = await tx
      .update(signupInvites)
      .set({ tokenHash })
      .where(eq(signupInvites.id, inviteId))
      .returning();
    await writeAudit(tx, {
      ...ctx.audit,
      action,
      targetType: "invite",
      targetId: inviteId,
      before: { sendCount: before.sendCount, tokenRotated: false },
      after: {
        tokenRotated: true,
        ...(action === "invite.send" ? { to: before.email } : {}),
      },
    });
    return after;
  });
  return { invite, url: buildInviteUrl(token, invite.emailLocale) };
}

/** Send / resend: rotates the token, emails the new link. Max 5 per 24h. */
export async function sendInvite(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("invite.send") });
    const parsed = inviteIdSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    await assertSendQuota(parsed.data.id);
    const { invite, url } = await rotate(parsed.data.id, "invite.send", ctx);
    await deliver(invite, url, ctx.user.id);
    return { id: invite.id };
  });
}

/** Raw tokens are never stored, so copying a link must issue a new one. */
export async function copyInviteLink(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("invite.send") });
    const parsed = inviteIdSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { url } = await rotate(parsed.data.id, "invite.link_copy", ctx);
    return { url };
  });
}

/** Edit an unused, unrevoked invite (super_admin). Expiry restarts from now. */
export async function updateInvite(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("invite.edit") });
    const parsed = updateInviteSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { id, expiresInDays, ...input } = parsed.data;
    await db.transaction(async (tx) => {
      const before = await lockInvite(tx, id);
      if (!isInviteEditable(getInviteStatus(before))) {
        throw new AppError("INVITE_NOT_EDITABLE");
      }
      const [after] = await tx
        .update(signupInvites)
        .set({ ...input, expiresAt: addDays(new Date(), expiresInDays) })
        .where(eq(signupInvites.id, id))
        .returning();
      await writeAudit(tx, {
        ...ctx.audit,
        action: "invite.update",
        targetType: "invite",
        targetId: id,
        before: snapshot(before),
        after: snapshot(after),
      });
    });
    return { id };
  });
}

export async function revokeInvite(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireBackoffice({ roles: rolesFor("invite.revoke") });
    const parsed = revokeInviteSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { id, reason } = parsed.data;
    await db.transaction(async (tx) => {
      const before = await lockInvite(tx, id);
      const [after] = await tx
        .update(signupInvites)
        .set({ revokedAt: new Date(), revokedBy: ctx.user.id })
        .where(
          and(
            eq(signupInvites.id, id),
            isNull(signupInvites.usedAt),
            isNull(signupInvites.revokedAt),
          ),
        )
        .returning();
      if (!after) throw new AppError("INVITE_NOT_EDITABLE");
      await writeAudit(tx, {
        ...ctx.audit,
        action: "invite.revoke",
        targetType: "invite",
        targetId: id,
        reason,
        before: { status: getInviteStatus(before) },
        after: { status: "revoked" },
      });
    });
    return { id };
  });
}
