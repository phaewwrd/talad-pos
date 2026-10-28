// Backoffice session limits, independent of Better Auth's global session
// settings (shop sessions keep the defaults).

export const BACKOFFICE_SESSION_MAX_MS = 8 * 60 * 60 * 1000; // absolute
export const BACKOFFICE_IDLE_MS = 60 * 60 * 1000; // since last activity
/** Activity is written back at most this often (session.updated_at). */
export const BACKOFFICE_TOUCH_MS = 60 * 1000;

export type SessionVerdict = "ok" | "touch" | "expired";

export function evaluateBackofficeSession(
  session: { createdAt: Date | string; updatedAt: Date | string },
  now: Date = new Date(),
): SessionVerdict {
  const t = now.getTime();
  const created = new Date(session.createdAt).getTime();
  const lastActive = new Date(session.updatedAt).getTime();
  if (t - created >= BACKOFFICE_SESSION_MAX_MS) return "expired";
  if (t - lastActive >= BACKOFFICE_IDLE_MS) return "expired";
  if (t - lastActive >= BACKOFFICE_TOUCH_MS) return "touch";
  return "ok";
}

export type BackofficeStage = "ready" | "change-password" | "setup-2fa";

/** Forced steps after login, in order. */
export function backofficeStage(user: {
  mustChangePassword?: boolean | null;
  twoFactorEnabled?: boolean | null;
}): BackofficeStage {
  if (user.mustChangePassword) return "change-password";
  if (!user.twoFactorEnabled) return "setup-2fa";
  return "ready";
}

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
