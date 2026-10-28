import type { Tx } from "@/db";
import { type AuditTargetType, platformAuditLogs } from "@/db/schema";

export const AUDIT_ACTIONS = [
  "invite.create",
  "invite.update",
  "invite.send",
  "invite.link_copy",
  "invite.revoke",
  "entitlement.update",
  "shop.suspend",
  "shop.reactivate",
  "shop.close",
  "shop.device_revoke",
  "owner.ban",
  "owner.unban",
  "owner.password_reset",
  "user.impersonate.start",
  "user.impersonate.stop",
  "backoffice_user.create",
  "backoffice_user.update",
  "backoffice_user.role_change",
  "backoffice_user.deactivate",
  "backoffice_user.reactivate",
  "backoffice_user.reset_2fa",
  "backoffice_user.password_change",
  "backoffice_user.2fa_enroll",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const SCRIPT_ACTOR_LABEL = "system:script";

export type AuditActor =
  | { id: string; label: string }
  | { id: null; label: typeof SCRIPT_ACTOR_LABEL };

export type AuditEntry = {
  actor: AuditActor;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append one platform audit row. Must be called with the same transaction as
 * the change it records, so both commit or neither does.
 */
export async function writeAudit(tx: Pick<Tx, "insert">, entry: AuditEntry) {
  const [row] = await tx
    .insert(platformAuditLogs)
    .values({
      actorId: entry.actor.id,
      actorLabel: entry.actor.label,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason?.trim() || null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent?.slice(0, 500) ?? null,
    })
    .returning({ id: platformAuditLogs.id });
  return row;
}
