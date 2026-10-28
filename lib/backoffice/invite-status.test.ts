import { describe, expect, it } from "vitest";
import {
  getInviteStatus,
  isInviteEditable,
  isInviteUsable,
} from "./invite-status";

const now = new Date("2026-10-28T12:00:00Z");
const future = new Date("2026-11-04T12:00:00Z");
const past = new Date("2026-10-27T12:00:00Z");
const base = { revokedAt: null, usedAt: null, sentAt: null, expiresAt: future };

describe("getInviteStatus", () => {
  it("is draft when nothing happened yet", () => {
    expect(getInviteStatus(base, now)).toBe("draft");
  });

  it("is sent once an email went out", () => {
    expect(getInviteStatus({ ...base, sentAt: past }, now)).toBe("sent");
  });

  it("is expired after expires_at, even if sent", () => {
    expect(
      getInviteStatus({ ...base, sentAt: past, expiresAt: past }, now),
    ).toBe("expired");
  });

  it("is not expired exactly at expires_at (strict <)", () => {
    expect(getInviteStatus({ ...base, expiresAt: now }, now)).toBe("draft");
  });

  it("used wins over expired", () => {
    expect(
      getInviteStatus({ ...base, usedAt: past, expiresAt: past }, now),
    ).toBe("used");
  });

  it("revoked wins over everything", () => {
    expect(
      getInviteStatus(
        { revokedAt: past, usedAt: past, sentAt: past, expiresAt: past },
        now,
      ),
    ).toBe("revoked");
  });

  it("accepts ISO strings (client DTOs)", () => {
    expect(
      getInviteStatus(
        {
          revokedAt: null,
          usedAt: null,
          sentAt: past.toISOString(),
          expiresAt: future.toISOString(),
        },
        now,
      ),
    ).toBe("sent");
  });
});

describe("invite status helpers", () => {
  it("only draft and sent links are usable", () => {
    expect(isInviteUsable("draft")).toBe(true);
    expect(isInviteUsable("sent")).toBe(true);
    expect(isInviteUsable("expired")).toBe(false);
    expect(isInviteUsable("used")).toBe(false);
    expect(isInviteUsable("revoked")).toBe(false);
  });

  it("used and revoked invites cannot be edited", () => {
    expect(isInviteEditable("used")).toBe(false);
    expect(isInviteEditable("revoked")).toBe(false);
    expect(isInviteEditable("expired")).toBe(true);
  });
});
