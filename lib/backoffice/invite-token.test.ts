import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
} from "./invite-token";

describe("invite tokens", () => {
  it("are 32 random bytes in base64url", () => {
    const { token } = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("store only the SHA-256 hex of the token", () => {
    const { token, tokenHash } = generateInviteToken();
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(tokenHash).not.toContain(token);
    expect(hashInviteToken(token)).toBe(tokenHash);
  });

  it("are unique", () => {
    const seen = new Set(
      Array.from({ length: 100 }, () => generateInviteToken().token),
    );
    expect(seen.size).toBe(100);
  });

  it("build the signup URL in the email locale", () => {
    expect(buildInviteUrl("abc_-1", "en", "https://pos.example/")).toBe(
      "https://pos.example/en/signup?token=abc_-1",
    );
    expect(buildInviteUrl("abc", "th", "https://pos.example")).toBe(
      "https://pos.example/th/signup?token=abc",
    );
  });
});
