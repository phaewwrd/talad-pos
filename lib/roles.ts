export const MEMBER_ROLES = ["owner", "manager", "cashier"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export function isMemberRole(value: unknown): value is MemberRole {
  return (MEMBER_ROLES as readonly unknown[]).includes(value);
}
