import { describe, expect, it } from "vitest";
import { backofficeStage, evaluateBackofficeSession } from "./session-policy";

const now = new Date("2026-10-28T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("evaluateBackofficeSession", () => {
  it("is ok right after activity", () => {
    expect(
      evaluateBackofficeSession(
        { createdAt: ago(5), updatedAt: ago(0.5) },
        now,
      ),
    ).toBe("ok");
  });

  it("asks to record activity after a minute", () => {
    expect(
      evaluateBackofficeSession({ createdAt: ago(30), updatedAt: ago(2) }, now),
    ).toBe("touch");
  });

  it("expires after 1 hour idle", () => {
    expect(
      evaluateBackofficeSession(
        { createdAt: ago(61), updatedAt: ago(60) },
        now,
      ),
    ).toBe("expired");
  });

  it("expires 8 hours after login even when active", () => {
    expect(
      evaluateBackofficeSession(
        { createdAt: ago(8 * 60), updatedAt: ago(0) },
        now,
      ),
    ).toBe("expired");
    expect(
      evaluateBackofficeSession(
        { createdAt: ago(8 * 60 - 1), updatedAt: ago(0) },
        now,
      ),
    ).toBe("ok");
  });
});

describe("backofficeStage", () => {
  it("forces password change first, then 2FA enrollment", () => {
    expect(
      backofficeStage({ mustChangePassword: true, twoFactorEnabled: false }),
    ).toBe("change-password");
    expect(
      backofficeStage({ mustChangePassword: true, twoFactorEnabled: true }),
    ).toBe("change-password");
    expect(
      backofficeStage({ mustChangePassword: false, twoFactorEnabled: false }),
    ).toBe("setup-2fa");
    expect(
      backofficeStage({ mustChangePassword: false, twoFactorEnabled: true }),
    ).toBe("ready");
  });
});
