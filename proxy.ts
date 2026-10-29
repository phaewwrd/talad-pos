import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { backofficeAccess } from "./lib/backoffice/proxy-access";
import { isSupplierLinkAvailable } from "./lib/suppliers/proxy-access";

const intl = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/pin",
  "/forgot-password",
  "/reset-password",
  "/shop-unavailable",
];

// Backoffice pages that handle their own (partial) session state.
const BACKOFFICE_OPEN_PATHS = [
  "/backoffice/login",
  "/backoffice/verify-2fa",
  "/backoffice/change-password",
  "/backoffice/setup-2fa",
];

const matches = (subPath: string, paths: string[]) =>
  paths.some((p) => subPath === p || subPath.startsWith(`${p}/`));

function forbidden() {
  return new NextResponse(
    '<!doctype html><title>403</title><p style="font-family:system-ui;padding:2rem">403 — Forbidden</p>',
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// Shop routes: optimistic check only (cookie presence); real authorization
// happens in requireMember(). Backoffice routes: the session must belong to a
// backoffice account (shop users get 403); requireBackoffice() still checks
// everything again on every page, action and route handler.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, maybeLocale, ...rest] = pathname.split("/");
  const hasLocale = (routing.locales as readonly string[]).includes(
    maybeLocale,
  );

  if (hasLocale) {
    const subPath = `/${rest.join("/")}`;

    if (subPath === "/backoffice" || subPath.startsWith("/backoffice/")) {
      if (!matches(subPath, BACKOFFICE_OPEN_PATHS)) {
        const access = await backofficeAccess(getSessionCookie(request));
        if (access === "forbidden") return forbidden();
        if (access === "none") {
          const url = request.nextUrl.clone();
          url.pathname = `/${maybeLocale}/backoffice/login`;
          url.search = "";
          return NextResponse.redirect(url);
        }
      }
      return intl(request);
    }

    // Public supplier stock links: no session needed. Dead links are rewritten
    // to a static 404 page, since the [token] page streams (status 200).
    if (rest[0] === "s") {
      const response = (await isSupplierLinkAvailable(rest[1]))
        ? intl(request)
        : NextResponse.rewrite(
            new URL(`/${maybeLocale}/s/unavailable`, request.url),
          );
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }

    if (!matches(subPath, PUBLIC_PATHS) && !getSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${maybeLocale}/login`;
      url.search =
        subPath === "/" ? "" : `?next=${encodeURIComponent(subPath)}`;
      return NextResponse.redirect(url);
    }
  }

  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
