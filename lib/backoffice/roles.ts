// Platform (backoffice) roles live on user.role (Better Auth admin plugin).
// Shop accounts use role "user" and organization membership roles instead.

export const BACKOFFICE_ROLES = ["super_admin", "support"] as const;
export type BackofficeRole = (typeof BACKOFFICE_ROLES)[number];

export function isBackofficeRole(value: unknown): value is BackofficeRole {
  return (BACKOFFICE_ROLES as readonly unknown[]).includes(value);
}

export const SUPER_ADMIN = ["super_admin"] as const;
