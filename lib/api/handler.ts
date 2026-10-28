import "server-only";
import { connection, NextResponse } from "next/server";
import { AppError, type ErrorCode } from "@/lib/errors";

const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  STAFF_INACTIVE: 403,
  FEATURE_DISABLED: 403,
  NO_ACTIVE_SHOP: 409,
  NOT_FOUND: 404,
  VALIDATION: 400,
  SESSION_EXPIRED: 401,
  PASSWORD_CHANGE_REQUIRED: 403,
  TWO_FACTOR_REQUIRED: 403,
  SHOP_SUSPENDED: 423,
  SHOP_CLOSED: 423,
  RATE_LIMITED: 429,
};

/** Route Handler wrapper: JSON body on success, `{ code }` on typed errors. */
export function apiRoute<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
) {
  return async (...args: Args) => {
    // Session-scoped data: never prerender or cache these responses.
    await connection();
    try {
      return NextResponse.json(await fn(...args), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { code: err.code, details: err.details },
          { status: STATUS[err.code] ?? 400 },
        );
      }
      console.error(err);
      return NextResponse.json({ code: "UNKNOWN" }, { status: 500 });
    }
  };
}
