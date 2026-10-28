import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { signupInvites } from "@/db/schema";
import {
  getInviteStatus,
  isInviteUsable,
} from "@/lib/backoffice/invite-status";
import { hashInviteToken } from "@/lib/backoffice/invite-token";

/** Look up a raw invite token; returns the invite only if it is usable. */
export async function findActiveInvite(token: string) {
  const [invite] = await db
    .select()
    .from(signupInvites)
    .where(eq(signupInvites.tokenHash, hashInviteToken(token)))
    .limit(1);
  if (!invite || !isInviteUsable(getInviteStatus(invite))) return null;
  return invite;
}
