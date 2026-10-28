import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { trustedDevices } from "@/db/schema";

export const DEVICE_COOKIE = "talad_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function secret() {
  const s = process.env.DEVICE_COOKIE_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("DEVICE_COOKIE_SECRET / BETTER_AUTH_SECRET not set");
  return s;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sign(token: string) {
  return createHmac("sha256", secret()).update(token).digest("base64url");
}

/** New random device token and its signed cookie value. */
export function newDeviceToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    tokenHash: hashToken(token),
    cookieValue: `${token}.${sign(token)}`,
  };
}

function unsign(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const [token, sig] = cookieValue.split(".");
  if (!token || !sig) return null;
  const expected = Buffer.from(sign(token));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return token;
}

/** Resolve a device cookie to its active trusted device row, if any. */
export async function findTrustedDevice(cookieValue: string | undefined) {
  const token = unsign(cookieValue);
  if (!token) return null;
  const [device] = await db
    .select({
      id: trustedDevices.id,
      organizationId: trustedDevices.organizationId,
      name: trustedDevices.name,
    })
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.tokenHash, hashToken(token)),
        isNull(trustedDevices.revokedAt),
      ),
    )
    .limit(1);
  return device ?? null;
}

export async function touchDevice(id: string) {
  await db
    .update(trustedDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(trustedDevices.id, id));
}
