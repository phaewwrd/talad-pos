// Used by proxy.ts for /[locale]/backoffice/**. Read-only lookup (no session
// refresh, no cookies written); requireBackoffice() remains the authority.
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { member, session, user } from "@/db/schema";
import { isBackofficeRole } from "@/lib/backoffice/roles";

export type BackofficeAccess = "none" | "forbidden" | "ok";

/** `cookieValue` is Better Auth's signed session cookie: `<token>.<signature>`. */
export async function backofficeAccess(
  cookieValue: string | null,
): Promise<BackofficeAccess> {
  if (!cookieValue) return "none";
  const token = decodeURIComponent(cookieValue).split(".")[0];
  if (!token) return "none";

  const [row] = await db
    .select({
      userId: user.id,
      role: user.role,
      banned: user.banned,
      impersonatedBy: session.impersonatedBy,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1);
  if (!row) return "none";
  if (!isBackofficeRole(row.role) || row.banned || row.impersonatedBy) {
    return "forbidden";
  }
  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, row.userId))
    .limit(1);
  return membership ? "forbidden" : "ok";
}
