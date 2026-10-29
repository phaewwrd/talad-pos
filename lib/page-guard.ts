import "server-only";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { isBackofficeRole } from "@/lib/backoffice/roles";
import type { FeatureKey } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import {
  getAuthSession,
  type MemberContext,
  requireMember,
} from "@/lib/permissions";
import type { MemberRole } from "@/lib/roles";

/**
 * For pages and the app chrome: the signed-in member, or a redirect when the
 * session can't use the app (signed out, shop suspended/closed, backoffice
 * account). Each page streams behind its own Suspense boundary, so each one
 * must redirect itself instead of throwing.
 */
export async function requirePageMember(
  options: { roles?: readonly MemberRole[]; feature?: FeatureKey } = {},
): Promise<MemberContext> {
  try {
    await requireMember();
  } catch (err) {
    if (
      err instanceof AppError &&
      (err.code === "SHOP_SUSPENDED" || err.code === "SHOP_CLOSED")
    ) {
      redirect(
        `/${await rootLocale()}/shop-unavailable?reason=${err.code === "SHOP_CLOSED" ? "closed" : "suspended"}`,
      );
    }
    if (err instanceof AppError && err.code === "NO_ACTIVE_SHOP") {
      const session = await getAuthSession();
      if (isBackofficeRole(session?.user.role))
        redirect(`/${await rootLocale()}/backoffice`);
    }
    redirect(`/${await rootLocale()}/login`);
  }
  // Member lookup is cached per request; this only applies role/feature checks.
  return requireMember(options);
}

/** For pages: resolve the member or report why the page can't be shown. */
export async function guardPage(options: {
  roles?: readonly MemberRole[];
  feature?: FeatureKey;
}): Promise<
  | { ok: true; ctx: MemberContext }
  | { ok: false; reason: "forbidden" | "upgrade" }
> {
  try {
    return { ok: true, ctx: await requirePageMember(options) };
  } catch (err) {
    if (err instanceof AppError && err.code === "FEATURE_DISABLED")
      return { ok: false, reason: "upgrade" };
    if (err instanceof AppError && err.code === "FORBIDDEN")
      return { ok: false, reason: "forbidden" };
    throw err;
  }
}
