"use server";

import { cookies, headers } from "next/headers";
import { AppError, runAction } from "@/lib/errors";
import { findLink } from "./public";
import { verifyPinSchema } from "./schemas";
import {
  checkPin,
  clearPinFailures,
  hashIp,
  newUnlockCookie,
  pinLockedUntil,
  recordPinFailure,
  UNLOCK_MAX_AGE,
  unlockCookieName,
} from "./security";

/**
 * Public (no login). Unknown, disabled and PIN-less links all fail the same
 * way so the response never reveals whether a token exists.
 */
export async function verifySupplierPin(raw: unknown) {
  return runAction(async () => {
    const parsed = verifyPinSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("PIN_INVALID");
    const { token, pin } = parsed.data;

    const link = await findLink(token);
    if (!link?.pinHash) throw new AppError("NOT_FOUND");

    const ipHash = hashIp(await headers());
    const locked = await pinLockedUntil(link.id, ipHash);
    if (locked) {
      throw new AppError("PIN_LOCKED", { lockedUntil: locked.toISOString() });
    }
    if (!(await checkPin(pin, link.pinHash))) {
      const r = await recordPinFailure(link.id, ipHash);
      if (r.locked) {
        throw new AppError("PIN_LOCKED", {
          lockedUntil: r.lockedUntil.toISOString(),
        });
      }
      throw new AppError("PIN_INVALID", { attemptsLeft: r.attemptsLeft });
    }

    await clearPinFailures(link.id, ipHash);
    (await cookies()).set(unlockCookieName(token), newUnlockCookie(link), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: UNLOCK_MAX_AGE,
    });
    return { ok: true as const };
  });
}
