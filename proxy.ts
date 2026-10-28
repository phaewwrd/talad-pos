import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/pin",
  "/forgot-password",
  "/reset-password",
];

// Optimistic check only (cookie presence). Real authorization happens on the
// server in requireMember() for every page, action and route handler.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, maybeLocale, ...rest] = pathname.split("/");
  const hasLocale = (routing.locales as readonly string[]).includes(
    maybeLocale,
  );

  if (hasLocale) {
    const subPath = `/${rest.join("/")}`;
    const isPublic = PUBLIC_PATHS.some(
      (p) => subPath === p || subPath.startsWith(`${p}/`),
    );
    if (!isPublic && !getSessionCookie(request)) {
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
