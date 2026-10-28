import "server-only";
import type { FeatureKey } from "@/lib/entitlements";
import { AppError } from "@/lib/errors";
import { type MemberContext, requireMember } from "@/lib/permissions";
import type { MemberRole } from "@/lib/roles";

/** For pages: resolve the member or report why the page can't be shown. */
export async function guardPage(options: {
  roles?: readonly MemberRole[];
  feature?: FeatureKey;
}): Promise<
  | { ok: true; ctx: MemberContext }
  | { ok: false; reason: "forbidden" | "upgrade" }
> {
  try {
    return { ok: true, ctx: await requireMember(options) };
  } catch (err) {
    if (err instanceof AppError && err.code === "FEATURE_DISABLED")
      return { ok: false, reason: "upgrade" };
    if (err instanceof AppError && err.code === "FORBIDDEN")
      return { ok: false, reason: "forbidden" };
    throw err;
  }
}
