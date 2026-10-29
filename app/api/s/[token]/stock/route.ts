import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { findLink, loadPublicStock } from "@/features/suppliers/public";
import {
  hashIp,
  hitRateLimit,
  isValidUnlockCookie,
  unlockCookieName,
} from "@/features/suppliers/security";
import { getStockVersion } from "@/lib/stock/version";

const HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

const CODES = { 401: "UNAUTHORIZED", 404: "NOT_FOUND", 429: "RATE_LIMITED" };

const fail = (status: keyof typeof CODES) =>
  NextResponse.json({ code: CODES[status] }, { status, headers: HEADERS });

/**
 * Public supplier stock poll. `?v=<version>` → 204 when nothing changed,
 * otherwise the new list. Same token / enabled / PIN checks as the page.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/s/[token]/stock">,
) {
  await connection();
  const { token } = await params;
  const link = await findLink(token);
  if (!link) return fail(404);

  if (!(await hitRateLimit(link.id, hashIp(request.headers), "api"))) {
    return fail(429);
  }
  if (link.pinHash) {
    const cookie = (await cookies()).get(unlockCookieName(token))?.value;
    if (!isValidUnlockCookie(link, cookie)) return fail(401);
  }

  const known = new URL(request.url).searchParams.get("v");
  if (
    known !== null &&
    Number(known) === (await getStockVersion(link.organizationId))
  ) {
    return new NextResponse(null, { status: 204, headers: HEADERS });
  }
  return NextResponse.json(await loadPublicStock(link), { headers: HEADERS });
}
