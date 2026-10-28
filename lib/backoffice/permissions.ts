// Backoffice capability matrix (docs §4.1). The UI hides what `can()` denies;
// Server Actions / Route Handlers enforce the same table with
// requireBackoffice({ roles: rolesFor(capability) }).
import type { BackofficeRole } from "@/lib/backoffice/roles";

const BOTH = ["super_admin", "support"] as const;
const SUPER = ["super_admin"] as const;

export const CAPABILITIES = {
  view: BOTH,
  "invite.create": BOTH,
  "invite.send": BOTH,
  "invite.revoke": BOTH,
  "invite.edit": SUPER,
  "entitlement.edit": SUPER,
  "shop.status": SUPER,
  "shop.close": SUPER,
  "owner.ban": SUPER,
  "owner.passwordReset": BOTH,
  "shop.devices.revoke": BOTH,
  "owner.impersonate": SUPER,
  "team.view": SUPER,
} as const satisfies Record<string, readonly BackofficeRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function rolesFor(capability: Capability): readonly BackofficeRole[] {
  return CAPABILITIES[capability];
}

export function can(role: BackofficeRole, capability: Capability) {
  return (CAPABILITIES[capability] as readonly BackofficeRole[]).includes(role);
}
