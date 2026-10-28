import { describe, expect, it } from "vitest";
import { type Capability, can } from "./permissions";

// The §4.1 table, row by row: [capability, super_admin, support].
const TABLE: [Capability, boolean, boolean][] = [
  ["view", true, true],
  ["invite.create", true, true],
  ["invite.send", true, true],
  ["invite.revoke", true, true],
  ["invite.edit", true, false],
  ["entitlement.edit", true, false],
  ["shop.status", true, false],
  ["shop.close", true, false],
  ["owner.ban", true, false],
  ["owner.passwordReset", true, true],
  ["shop.devices.revoke", true, true],
  ["owner.impersonate", true, false],
  ["team.view", true, false],
];

describe("backoffice permission matrix", () => {
  it.each(TABLE)("%s → super_admin %s, support %s", (cap, sa, sup) => {
    expect(can("super_admin", cap)).toBe(sa);
    expect(can("support", cap)).toBe(sup);
  });
});
