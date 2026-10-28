import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization, staffCredentials, user } from "@/db/schema";
import { isMemberRole, type MemberRole } from "@/lib/roles";

export type PinStaff = {
  id: string;
  name: string;
  image: string | null;
  role: MemberRole;
};

/** Active PIN staff of a shop — only names/avatars, never credentials. */
export async function listPinStaff(
  organizationId: string,
): Promise<PinStaff[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: member.role,
    })
    .from(staffCredentials)
    .innerJoin(user, eq(user.id, staffCredentials.userId))
    .innerJoin(
      member,
      and(
        eq(member.userId, staffCredentials.userId),
        eq(member.organizationId, staffCredentials.organizationId),
      ),
    )
    .where(
      and(
        eq(staffCredentials.organizationId, organizationId),
        eq(staffCredentials.isActive, true),
      ),
    )
    .orderBy(asc(user.name));
  return rows.flatMap((r) =>
    isMemberRole(r.role) ? [{ ...r, role: r.role }] : [],
  );
}

export async function getShopName(organizationId: string) {
  const [row] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return row?.name ?? "";
}
