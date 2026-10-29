import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { type SupplierAttemptKind, supplierLinkAttempts } from "@/db/schema";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
export const UNLOCK_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Requests per minute per link + visitor. */
export const RATE_LIMITS: Record<
  Exclude<SupplierAttemptKind, "pin">,
  number
> = {
  page: 30,
  api: 30,
};

function secret() {
  const s = process.env.SUPPLIER_LINK_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("SUPPLIER_LINK_SECRET / BETTER_AUTH_SECRET not set");
  return s;
}

const hmac = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("base64url");

/** 32 random bytes, base64url. Never derived from shop or supplier ids. */
export function newLinkToken() {
  return randomBytes(32).toString("base64url");
}

/** Cheap shape check before touching the database. */
export function isTokenShaped(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Salted hash of the visitor's IP; the raw IP is never stored. */
export function hashIp(headers: Headers) {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return hmac(`ip:${ip}`).slice(0, 32);
}

export function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export function checkPin(pin: string, pinHash: string) {
  return bcrypt.compare(pin, pinHash);
}

// ---------- Unlock cookie (remembers a device that entered the PIN) ----------

type UnlockLink = { token: string; pinUpdatedAt: Date | null };

/** Cookie name per link; derived from the token so it reveals nothing. */
export function unlockCookieName(token: string) {
  return `talad_sup_${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}

// The token and PIN version are signed in: regenerating the link or changing
// the PIN invalidates every cookie issued before.
const unlockSignature = (link: UnlockLink, expires: number) =>
  hmac(
    `sup-unlock:${link.token}:${link.pinUpdatedAt?.getTime() ?? 0}:${expires}`,
  );

export function newUnlockCookie(link: UnlockLink) {
  const expires = Math.floor(Date.now() / 1000) + UNLOCK_MAX_AGE;
  return `${expires}.${unlockSignature(link, expires)}`;
}

export function isValidUnlockCookie(
  link: UnlockLink,
  value: string | undefined,
) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  const expires = Number(exp);
  if (!sig || !Number.isInteger(expires)) return false;
  if (expires < Date.now() / 1000) return false;
  const expected = Buffer.from(unlockSignature(link, expires));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---------- Rate limits / PIN lockout (fixed windows in Postgres) ----------

const attemptKey = (
  linkId: string,
  ipHash: string,
  kind: SupplierAttemptKind,
) =>
  and(
    eq(supplierLinkAttempts.linkId, linkId),
    eq(supplierLinkAttempts.ipHash, ipHash),
    eq(supplierLinkAttempts.kind, kind),
  );

/** Count one request; false once the per-minute limit is exceeded. */
export async function hitRateLimit(
  linkId: string,
  ipHash: string,
  kind: Exclude<SupplierAttemptKind, "pin">,
) {
  const expired = sql`${supplierLinkAttempts.windowStartedAt} < now() - interval '1 minute'`;
  const [row] = await db
    .insert(supplierLinkAttempts)
    .values({ linkId, ipHash, kind, count: 1 })
    .onConflictDoUpdate({
      target: [
        supplierLinkAttempts.linkId,
        supplierLinkAttempts.ipHash,
        supplierLinkAttempts.kind,
      ],
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${supplierLinkAttempts.count} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${expired} THEN now() ELSE ${supplierLinkAttempts.windowStartedAt} END`,
      },
    })
    .returning({ count: supplierLinkAttempts.count });
  return row.count <= RATE_LIMITS[kind];
}

/** Lock end time when this visitor is locked out of the PIN screen. */
export async function pinLockedUntil(linkId: string, ipHash: string) {
  const [row] = await db
    .select({ lockedUntil: supplierLinkAttempts.lockedUntil })
    .from(supplierLinkAttempts)
    .where(attemptKey(linkId, ipHash, "pin"));
  return row?.lockedUntil && row.lockedUntil > new Date()
    ? row.lockedUntil
    : null;
}

/** Record a wrong PIN; the 5th in a row locks for 15 minutes. */
export async function recordPinFailure(linkId: string, ipHash: string) {
  const next = sql`${supplierLinkAttempts.count} + 1`;
  const [row] = await db
    .insert(supplierLinkAttempts)
    .values({ linkId, ipHash, kind: "pin", count: 1 })
    .onConflictDoUpdate({
      target: [
        supplierLinkAttempts.linkId,
        supplierLinkAttempts.ipHash,
        supplierLinkAttempts.kind,
      ],
      set: {
        count: sql`CASE WHEN ${next} >= ${PIN_MAX_ATTEMPTS} THEN 0 ELSE ${next} END`,
        lockedUntil: sql`CASE WHEN ${next} >= ${PIN_MAX_ATTEMPTS} THEN now() + make_interval(mins => ${PIN_LOCK_MINUTES}) ELSE NULL END`,
      },
    })
    .returning({
      count: supplierLinkAttempts.count,
      lockedUntil: supplierLinkAttempts.lockedUntil,
    });
  return row.lockedUntil
    ? { locked: true as const, lockedUntil: row.lockedUntil }
    : { locked: false as const, attemptsLeft: PIN_MAX_ATTEMPTS - row.count };
}

export async function clearPinFailures(linkId: string, ipHash: string) {
  await db
    .delete(supplierLinkAttempts)
    .where(attemptKey(linkId, ipHash, "pin"));
}
