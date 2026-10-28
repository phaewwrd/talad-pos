import "server-only";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import type { ShellSession } from "@/components/shell/shell-types";
import { db } from "@/db";
import { member, organization, shopSettings } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  getAuthSession,
  type MemberContext,
  requireMember,
} from "@/lib/permissions";

async function loginPath() {
  return `/${await rootLocale()}/login`;
}

/** The signed-in member for the app chrome; redirects when not usable. */
export async function getShellSession(): Promise<ShellSession> {
  let ctx: MemberContext;
  try {
    ctx = await requireMember();
  } catch (err) {
    if (err instanceof AppError && err.code === "NO_ACTIVE_SHOP") {
      const session = await getAuthSession();
      if (session?.user.role === "admin")
        redirect(`/${await rootLocale()}/admin/invites`);
    }
    redirect(await loginPath());
  }

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

  return {
    user: { id: ctx.user.id, name: ctx.user.name, image: ctx.user.image },
    role: ctx.role,
    isPlatformAdmin: ctx.isPlatformAdmin,
    activeShop: {
      id: ctx.organizationId,
      name: active?.displayName ?? active?.name ?? "",
      logoUrl: active?.logoUrl ?? null,
    },
    shops: shops.map((s) => ({ id: s.id, name: s.displayName ?? s.name })),
    isPinSession: ctx.isPinSession,
  };
}
