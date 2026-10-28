import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
import { isBackofficeRole } from "@/lib/backoffice/roles";
import { AppError } from "@/lib/errors";

/** The target must be a shop owner — never a backoffice account. */
export async function requireShopOwner(
  userId: string,
  organizationId?: string,
) {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
    })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(
      and(
        eq(user.id, userId),
        eq(member.role, "owner"),
        ...(organizationId ? [eq(member.organizationId, organizationId)] : []),
      ),
    )
    .limit(1);
  if (!row || isBackofficeRole(row.role)) throw new AppError("NOT_FOUND");
  return row;
}
