// Account creation and role / password / profile changes by an admin happen
// only in scripts/backoffice/* — never over HTTP. Platform roles also lack
// these permissions (lib/auth.ts); this is defense in depth.
export const BLOCKED_AUTH_PATHS = [
  "/admin/create-user",
  "/admin/set-role",
  "/admin/update-user",
  "/admin/set-user-password",
  "/admin/remove-user",
] as const;

/** True for /api/auth/<blocked path> (case-insensitive, any trailing slashes). */
export function isBlockedAuthPath(pathname: string) {
  const path = decodeURIComponent(pathname)
    .toLowerCase()
    .replace(/^\/api\/auth/, "")
    .replace(/\/+$/, "");
  return BLOCKED_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
