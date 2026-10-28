import { createHash, randomBytes } from "node:crypto";
import type { EmailLocale } from "@/db/schema";

export const INVITE_TOKEN_BYTES = 32;

/** SHA-256 hex. Same scheme as lib/devices.ts `hashToken`, used by sign-up. */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A new raw token (32 random bytes, base64url) and the hash we store. */
export function generateInviteToken() {
  const token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function appBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/+$/, "");
}

/** `${NEXT_PUBLIC_APP_URL}/${locale}/signup?token=…` */
export function buildInviteUrl(
  token: string,
  locale: EmailLocale,
  baseUrl: string = appBaseUrl(),
) {
  return `${baseUrl.replace(/\/+$/, "")}/${locale}/signup?token=${encodeURIComponent(token)}`;
}
