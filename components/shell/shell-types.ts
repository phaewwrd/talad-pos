import type { MemberRole } from "@/lib/roles";

/** Narrow, client-safe view of the signed-in member for the app chrome. */
export type ShellSession = {
  user: { id: string; name: string; image: string | null };
  role: MemberRole;
  activeShop: { id: string; name: string; logoUrl: string | null };
  shops: { id: string; name: string }[];
  /** Signed in with a staff PIN on a trusted device. */
  isPinSession: boolean;
  /** A backoffice super_admin is impersonating this owner. */
  impersonating: boolean;
};
