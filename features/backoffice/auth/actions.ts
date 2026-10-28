"use server";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { backofficeLoginAttempts, member, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/backoffice/audit";
import { requestMeta, requireBackoffice } from "@/lib/backoffice/guard";
import { isBackofficeRole } from "@/lib/backoffice/roles";
import {
  backofficeStage,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
} from "@/lib/backoffice/session-policy";
import { AppError, runAction } from "@/lib/errors";
import {
  type BackofficeNextStep,
  backofficeLoginSchema,
  changePasswordSchema,
  confirmTwoFactorSchema,
  startTwoFactorSchema,
  verifyTwoFactorSchema,
} from "./schemas";

function nextStep(u: {
  mustChangePassword?: boolean | null;
  twoFactorEnabled?: boolean | null;
}): BackofficeNextStep {
  const stage = backofficeStage(u);
  return stage === "ready" ? "console" : stage;
}

async function recordAttempt(email: string, success: boolean) {
  const { ip } = await requestMeta();
  await db.insert(backofficeLoginAttempts).values({ email, success, ip });
}

/**
 * Email + password login for backoffice accounts only. Anything else — unknown
 * email, shop account, banned, wrong password — is the same generic
 * INVALID_CREDENTIALS (no account enumeration). 5 failures / email / 15 min.
 */
export async function backofficeLogin(raw: unknown) {
  return runAction(async (): Promise<{ next: BackofficeNextStep }> => {
    const parsed = backofficeLoginSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { email, password } = parsed.data;

    const [{ failures }] = await db
      .select({ failures: count() })
      .from(backofficeLoginAttempts)
      .where(
        and(
          eq(backofficeLoginAttempts.email, email),
          eq(backofficeLoginAttempts.success, false),
          gte(
            backofficeLoginAttempts.createdAt,
            new Date(Date.now() - LOGIN_WINDOW_MS),
          ),
        ),
      );
    if (failures >= LOGIN_MAX_FAILURES) throw new AppError("RATE_LIMITED");

    const reject = async (): Promise<never> => {
      await recordAttempt(email, false);
      throw new AppError("INVALID_CREDENTIALS");
    };

    const [account] = await db
      .select({ id: user.id, role: user.role, banned: user.banned })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`)
      .limit(1);
    // TODO(decision): unknown emails return faster than a password check;
    // add a dummy hash if timing-based enumeration becomes a concern.
    if (!account || !isBackofficeRole(account.role) || account.banned) {
      return reject();
    }
    const [membership] = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, account.id))
      .limit(1);
    if (membership) return reject();

    let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
    try {
      result = await auth.api.signInEmail({
        body: { email, password, rememberMe: false },
        headers: await headers(),
      });
    } catch {
      return reject();
    }

    // Password OK; the session is created only after TOTP verification.
    if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
      return { next: "verify-2fa" };
    }
    await recordAttempt(email, true);
    const [fresh] = await db
      .select({
        mustChangePassword: user.mustChangePassword,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(eq(user.id, account.id));
    return { next: nextStep(fresh) };
  });
}

/** Second step of login: TOTP (or a backup code) creates the session. */
export async function verifyBackofficeTwoFactor(raw: unknown) {
  return runAction(async (): Promise<{ next: BackofficeNextStep }> => {
    const parsed = verifyTwoFactorSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const { method, code } = parsed.data;
    let verifiedUser: { id: string; email: string };
    try {
      const res =
        method === "totp"
          ? await auth.api.verifyTOTP({
              body: { code, trustDevice: false },
              headers: await headers(),
            })
          : await auth.api.verifyBackupCode({
              body: { code, trustDevice: false },
              headers: await headers(),
            });
      verifiedUser = res.user;
    } catch {
      throw new AppError("TWO_FACTOR_INVALID");
    }
    await recordAttempt(verifiedUser.email.toLowerCase(), true);
    const [fresh] = await db
      .select({
        mustChangePassword: user.mustChangePassword,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(eq(user.id, verifiedUser.id));
    return { next: nextStep(fresh) };
  });
}

export async function changeBackofficePassword(raw: unknown) {
  return runAction(async (): Promise<{ next: BackofficeNextStep }> => {
    const ctx = await requireBackoffice({ allowStage: "change-password" });
    const parsed = changePasswordSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    try {
      // Revokes every other session and issues a fresh one for this browser.
      await auth.api.changePassword({
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch {
      throw new AppError("PASSWORD_INCORRECT");
    }
    const after = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(user)
        .set({ mustChangePassword: false })
        .where(eq(user.id, ctx.user.id))
        .returning({
          mustChangePassword: user.mustChangePassword,
          twoFactorEnabled: user.twoFactorEnabled,
        });
      await writeAudit(tx, {
        ...ctx.audit,
        action: "backoffice_user.password_change",
        targetType: "backoffice_user",
        targetId: ctx.user.id,
        before: { mustChangePassword: ctx.stage === "change-password" },
        after: { mustChangePassword: false },
      });
      return row;
    });
    return { next: nextStep(after) };
  });
}

/** Step 1 of enrollment: returns the TOTP URI (for the QR) and backup codes. */
export async function startTwoFactorEnrollment(raw: unknown) {
  return runAction(async () => {
    await requireBackoffice({ allowStage: "setup-2fa" });
    const parsed = startTwoFactorSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    const current = await auth.api.getSession({ headers: await headers() });
    if (current?.user.twoFactorEnabled) throw new AppError("INVALID_STATE");
    try {
      const res = await auth.api.enableTwoFactor({
        body: { password: parsed.data.password },
        headers: await headers(),
      });
      if (!("totpURI" in res)) throw new AppError("INVALID_STATE");
      const secret = new URL(res.totpURI).searchParams.get("secret") ?? "";
      return { totpURI: res.totpURI, secret, backupCodes: res.backupCodes };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("PASSWORD_INCORRECT");
    }
  });
}

/** Step 2 of enrollment: the first valid code turns 2FA on. */
export async function confirmTwoFactorEnrollment(raw: unknown) {
  return runAction(async (): Promise<{ next: BackofficeNextStep }> => {
    const ctx = await requireBackoffice({ allowStage: "setup-2fa" });
    const parsed = confirmTwoFactorSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION");
    try {
      await auth.api.verifyTOTP({
        body: { code: parsed.data.code },
        headers: await headers(),
      });
    } catch {
      throw new AppError("TWO_FACTOR_INVALID");
    }
    await db.transaction(async (tx) => {
      await writeAudit(tx, {
        ...ctx.audit,
        action: "backoffice_user.2fa_enroll",
        targetType: "backoffice_user",
        targetId: ctx.user.id,
        before: { twoFactorEnabled: false },
        after: { twoFactorEnabled: true },
      });
    });
    return { next: "console" };
  });
}
