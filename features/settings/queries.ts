import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  member,
  organization,
  shopSettings,
  staffCredentials,
  trustedDevices,
  user,
} from "@/db/schema";

export async function getSettings(organizationId: string) {
  const [s] = await db
    .select()
    .from(shopSettings)
    .where(eq(shopSettings.organizationId, organizationId));
  return s ?? null;
}

export async function listStaff(organizationId: string) {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      role: member.role,
      isActive: staffCredentials.isActive,
      lockedUntil: staffCredentials.lockedUntil,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(
      staffCredentials,
      and(
        eq(staffCredentials.userId, member.userId),
        eq(staffCredentials.organizationId, member.organizationId),
      ),
    )
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.role, ["manager", "cashier"]),
      ),
    )
    .orderBy(asc(user.name));
  return rows.map((r) => ({
    ...r,
    lockedUntil: r.lockedUntil?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listDevices(organizationId: string) {
  const rows = await db
    .select({
      id: trustedDevices.id,
      name: trustedDevices.name,
      createdAt: trustedDevices.createdAt,
      lastSeenAt: trustedDevices.lastSeenAt,
      revokedAt: trustedDevices.revokedAt,
      createdByName: user.name,
    })
    .from(trustedDevices)
    .leftJoin(user, eq(user.id, trustedDevices.createdBy))
    .where(eq(trustedDevices.organizationId, organizationId))
    .orderBy(desc(trustedDevices.createdAt));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));
}

export async function listOwnedShops(userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, userId), eq(member.role, "owner")))
    .orderBy(asc(member.createdAt));
}

export type StaffDTO = Awaited<ReturnType<typeof listStaff>>[number];
export type DeviceDTO = Awaited<ReturnType<typeof listDevices>>[number];
export type SettingsDTO = NonNullable<Awaited<ReturnType<typeof getSettings>>>;
