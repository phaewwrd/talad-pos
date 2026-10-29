import "server-only";
import { asc, eq } from "drizzle-orm";
import type { ShellSession } from "@/components/shell/shell-types";
import { db } from "@/db";
import { member, organization, shopSettings } from "@/db/schema";
import { requirePageMember } from "@/lib/page-guard";
import { getAuthSession } from "@/lib/permissions";

/** The signed-in member for the app chrome; redirects when not usable. */
export async function getShellSession(): Promise<ShellSession> {
  const ctx = await requirePageMember();

  const shops = await db
    .select({
      id: organization.id,
      name: organization.name,
      displayName: shopSettings.displayName,
      logoUrl: shopSettings.logoUrl,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(shopSettings, eq(shopSettings.organizationId, organization.id))
    .where(eq(member.userId, ctx.user.id))
    .orderBy(asc(member.createdAt));

  const active = shops.find((s) => s.id === ctx.organizationId);
  const authSession = await getAuthSession();

  return {
    user: { id: ctx.user.id, name: ctx.user.name, image: ctx.user.image },
    role: ctx.role,
    activeShop: {
      id: ctx.organizationId,
      name: active?.displayName ?? active?.name ?? "",
      logoUrl: active?.logoUrl ?? null,
    },
    shops: shops.map((s) => ({ id: s.id, name: s.displayName ?? s.name })),
    isPinSession: ctx.isPinSession,
    impersonating: !!authSession?.session.impersonatedBy,
  };
}
