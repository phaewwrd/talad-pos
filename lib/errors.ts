// Server errors are returned as codes; the client translates them with
// `errors.<code>` from messages/*.json. Never send localized text from the server.
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NO_ACTIVE_SHOP",
  "NOT_FOUND",
  "VALIDATION",
  "FEATURE_DISABLED",
  "LIMIT_REACHED",
  "INVITE_INVALID",
  "INVITE_EMAIL_MISMATCH",
  "EMAIL_TAKEN",
  "DEVICE_NOT_TRUSTED",
  "PIN_INVALID",
  "PIN_LOCKED",
  "STAFF_INACTIVE",
  "INSUFFICIENT_STOCK",
  "ORDER_LOCKED",
  "REASON_REQUIRED",
  "INVALID_STATUS_TRANSITION",
  "SKU_TAKEN",
  "CATEGORY_IN_USE",
  // Backoffice
  "INVALID_CREDENTIALS",
  "RATE_LIMITED",
  "SESSION_EXPIRED",
  "PASSWORD_CHANGE_REQUIRED",
  "TWO_FACTOR_REQUIRED",
  "TWO_FACTOR_INVALID",
  "PASSWORD_INCORRECT",
  "PASSWORD_REUSED",
  "SEND_LIMIT_REACHED",
  "EMAIL_SEND_FAILED",
  "EMAIL_REQUIRED",
  "INVITE_NOT_EDITABLE",
  "CONFIRMATION_MISMATCH",
  "SHOP_CLOSED",
  "SHOP_SUSPENDED",
  "INVALID_STATE",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, string | number>,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: Record<string, string | number> };

/** Wrap a Server Action body so typed errors become serializable results. */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, details: err.details };
    }
    // Let Next.js redirect()/notFound() control-flow errors through.
    if (
      err instanceof Error &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_")
    ) {
      throw err;
    }
    console.error(err);
    return { ok: false, code: "UNKNOWN" };
  }
}
