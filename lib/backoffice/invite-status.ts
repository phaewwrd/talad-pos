// Invite status is derived, never stored. This is the single source of truth;
// `inviteStatusSql` in features/backoffice/invites/queries.ts mirrors the same
// order for SQL filtering.

export const INVITE_STATUSES = [
  "draft",
  "sent",
  "used",
  "expired",
  "revoked",
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

type DateLike = Date | string | null | undefined;

const toDate = (d: DateLike) => (d ? new Date(d) : null);

export function getInviteStatus(
  invite: {
    revokedAt: DateLike;
    usedAt: DateLike;
    expiresAt: Date | string;
    sentAt: DateLike;
  },
  now: Date = new Date(),
): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  const expiresAt = toDate(invite.expiresAt);
  if (expiresAt && expiresAt.getTime() < now.getTime()) return "expired";
  if (invite.sentAt) return "sent";
  return "draft";
}

/** A link can be used to sign up only while the invite is draft or sent. */
export function isInviteUsable(status: InviteStatus) {
  return status === "draft" || status === "sent";
}

/** Limits / invite settings can be edited only before the invite is used or revoked. */
export function isInviteEditable(status: InviteStatus) {
  return status === "draft" || status === "sent" || status === "expired";
}
