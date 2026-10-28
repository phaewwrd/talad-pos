import bcrypt from "bcryptjs";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { and, eq, sql } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { member, staffCredentials } from "@/db/schema";
import { DEVICE_COOKIE, findTrustedDevice, touchDevice } from "@/lib/devices";
import type { ErrorCode } from "@/lib/errors";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 5;
export const PIN_PATTERN = /^\d{4,6}$/;

export function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

function fail(
  code: ErrorCode,
  status: "UNAUTHORIZED" | "FORBIDDEN" | "TOO_MANY_REQUESTS" = "UNAUTHORIZED",
  extra?: Record<string, unknown>,
) {
  return new APIError(status, { code, message: code, ...extra });
}

/**
 * Staff PIN login on a trusted device. Creates a normal Better Auth session
 * for the staff user with the device's organization active.
 *
 * POST /api/auth/pin/sign-in  { userId, pin }
 */
export const pinLogin = () =>
  ({
    id: "talad-pin-login",
    endpoints: {
      pinSignIn: createAuthEndpoint(
        "/pin/sign-in",
        {
          method: "POST",
          body: z.object({
            userId: z.uuid(),
            pin: z.string().regex(PIN_PATTERN),
          }),
        },
        async (ctx) => {
          const device = await findTrustedDevice(
            ctx.getCookie(DEVICE_COOKIE) ?? undefined,
          );
          if (!device) throw fail("DEVICE_NOT_TRUSTED", "FORBIDDEN");

          const [cred] = await db
            .select()
            .from(staffCredentials)
            .innerJoin(
              member,
              and(
                eq(member.userId, staffCredentials.userId),
                eq(member.organizationId, staffCredentials.organizationId),
              ),
            )
            .where(
              and(
                eq(staffCredentials.userId, ctx.body.userId),
                eq(staffCredentials.organizationId, device.organizationId),
              ),
            )
            .limit(1);
          if (!cred) throw fail("PIN_INVALID");
          const credential = cred.staff_credentials;
          if (!credential.isActive) throw fail("STAFF_INACTIVE", "FORBIDDEN");

          const now = new Date();
          if (credential.lockedUntil && credential.lockedUntil > now) {
            throw fail("PIN_LOCKED", "TOO_MANY_REQUESTS", {
              lockedUntil: credential.lockedUntil.toISOString(),
            });
          }

          const ok = await bcrypt.compare(ctx.body.pin, credential.pinHash);
          if (!ok) {
            // Atomic increment; lock and reset the counter on the 5th miss.
            const [updated] = await db
              .update(staffCredentials)
              .set({
                failedAttempts: sql`CASE WHEN ${staffCredentials.failedAttempts} + 1 >= ${PIN_MAX_ATTEMPTS} THEN 0 ELSE ${staffCredentials.failedAttempts} + 1 END`,
                lockedUntil: sql`CASE WHEN ${staffCredentials.failedAttempts} + 1 >= ${PIN_MAX_ATTEMPTS} THEN now() + make_interval(mins => ${PIN_LOCK_MINUTES}) ELSE ${staffCredentials.lockedUntil} END`,
              })
              .where(eq(staffCredentials.userId, credential.userId))
              .returning({
                failedAttempts: staffCredentials.failedAttempts,
                lockedUntil: staffCredentials.lockedUntil,
              });
            if (updated?.lockedUntil && updated.lockedUntil > now) {
              throw fail("PIN_LOCKED", "TOO_MANY_REQUESTS", {
                lockedUntil: updated.lockedUntil.toISOString(),
              });
            }
            throw fail("PIN_INVALID", "UNAUTHORIZED", {
              attemptsLeft: PIN_MAX_ATTEMPTS - (updated?.failedAttempts ?? 0),
            });
          }

          await db
            .update(staffCredentials)
            .set({ failedAttempts: 0, lockedUntil: null })
            .where(eq(staffCredentials.userId, credential.userId));
          await touchDevice(device.id);

          const user = await ctx.context.internalAdapter.findUserById(
            credential.userId,
          );
          if (!user) throw fail("PIN_INVALID");
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            false,
            { activeOrganizationId: device.organizationId },
          );
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true as const });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
