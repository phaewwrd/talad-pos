import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { cache } from "react";
import { db } from "@/db";
import { member, session as sessionTable } from "@/db/schema";
import type { AuditActor } from "@/lib/backoffice/audit";
import { type BackofficeRole, isBackofficeRole } from "@/lib/backoffice/roles";
import {
  type BackofficeStage,
  backofficeStage,
  evaluateBackofficeSession,
} from "@/lib/backoffice/session-policy";
import { AppError } from "@/lib/errors";
import { getAuthSession } from "@/lib/permissions";

export type BackofficeContext = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  role: BackofficeRole;
  stage: BackofficeStage;
  sessionId: string;
  /** Who to record in platform_audit_logs, with request metadata. */
  audit: { actor: AuditActor; ip: string | null; userAgent: string | null };
};

type Resolution =
  | { state: "anonymous" | "expired" | "forbidden" }
  | { state: "ok"; ctx: BackofficeContext };

export async function requestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Shop accounts and backoffice accounts never mix: any membership = shop user. */
async function isShopMember(userId: string) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  return !!row;
}

const resolveBackoffice = cache(async (): Promise<Resolution> => {
  const s = await getAuthSession();
  if (!s) return { state: "anonymous" };
  const role = s.user.role;
  if (
    !isBackofficeRole(role) ||
    s.user.banned ||
    s.session.impersonatedBy ||
    (await isShopMember(s.user.id))
  ) {
    return { state: "forbidden" };
  }

  const verdict = evaluateBackofficeSession(s.session);
  if (verdict === "expired") {
    await db.delete(sessionTable).where(eq(sessionTable.id, s.session.id));
    return { state: "expired" };
  }
  if (verdict === "touch") {
    await db
      .update(sessionTable)
      .set({ updatedAt: new Date() })
      .where(eq(sessionTable.id, s.session.id));
  }

  const meta = await requestMeta();
  return {
    state: "ok",
    ctx: {
      user: {
        id: s.user.id,
        name: s.user.name,
        email: s.user.email,
        image: s.user.image ?? null,
      },
      role,
      stage: backofficeStage(s.user),
      sessionId: s.session.id,
      audit: { actor: { id: s.user.id, label: s.user.email }, ...meta },
    },
  };
});

/**
 * Authorize a backoffice page, Server Action or Route Handler.
 * Throws AppError UNAUTHORIZED / SESSION_EXPIRED (401), FORBIDDEN (403), or
 * PASSWORD_CHANGE_REQUIRED / TWO_FACTOR_REQUIRED until the forced steps are done.
 */
export async function requireBackoffice(
  options: {
    roles?: readonly BackofficeRole[];
    /** Forced-step pages pass the stage they handle. */
    allowStage?: BackofficeStage;
  } = {},
): Promise<BackofficeContext> {
  const r = await resolveBackoffice();
  if (r.state !== "ok") {
    throw new AppError(
      r.state === "anonymous"
        ? "UNAUTHORIZED"
        : r.state === "expired"
          ? "SESSION_EXPIRED"
          : "FORBIDDEN",
    );
  }
  const { ctx } = r;
  if (ctx.stage !== "ready" && ctx.stage !== options.allowStage) {
    throw new AppError(
      ctx.stage === "change-password"
        ? "PASSWORD_CHANGE_REQUIRED"
        : "TWO_FACTOR_REQUIRED",
    );
  }
  if (options.roles && !options.roles.includes(ctx.role)) {
    throw new AppError("FORBIDDEN");
  }
  return ctx;
}

export async function backofficePath(path: string) {
  return `/${await rootLocale()}/backoffice${path}`;
}

/**
 * For pages: like requireBackoffice, but redirects to login / forced steps.
 * Returns `{ ok: false }` when the role is not allowed (render a 403 state).
 */
export async function guardBackofficePage(
  options: Parameters<typeof requireBackoffice>[0] = {},
): Promise<{ ok: true; ctx: BackofficeContext } | { ok: false }> {
  try {
    return { ok: true, ctx: await requireBackoffice(options) };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    switch (err.code) {
      case "UNAUTHORIZED":
        redirect(await backofficePath("/login"));
        break;
      case "SESSION_EXPIRED":
        redirect(await backofficePath("/login?expired=1"));
        break;
      case "PASSWORD_CHANGE_REQUIRED":
        redirect(await backofficePath("/change-password"));
        break;
      case "TWO_FACTOR_REQUIRED":
        redirect(await backofficePath("/setup-2fa"));
        break;
      case "FORBIDDEN":
        return { ok: false };
    }
    throw err;
  }
}
