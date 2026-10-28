import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { signupInvites } from "@/db/schema";
import { hashToken } from "@/lib/devices";

export type InviteStatus = "active" | "used" | "expired" | "revoked";

export function inviteStatus(
  invite: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  if (invite.expiresAt <= now) return "expired";
  return "active";
}

/** Look up a raw invite token; returns the invite only if it is usable. */
export async function findActiveInvite(token: string) {
  const [invite] = await db
    .select()
    .from(signupInvites)
    .where(eq(signupInvites.tokenHash, hashToken(token)))
    .limit(1);
  if (!invite || inviteStatus(invite) !== "active") return null;
  return invite;
}
