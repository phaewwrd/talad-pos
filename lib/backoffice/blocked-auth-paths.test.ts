import { describe, expect, it } from "vitest";
import { isBlockedAuthPath } from "./blocked-auth-paths";

describe("isBlockedAuthPath", () => {
  it.each([
    "/api/auth/admin/create-user",
    "/api/auth/admin/set-role",
    "/api/auth/admin/update-user",
    "/api/auth/admin/set-user-password",
    "/api/auth/admin/remove-user",
    "/api/auth/admin/Create-User",
    "/api/auth/admin/set-role/",
    "/api/auth/admin/set%2Drole",
  ])("blocks %s", (path) => {
    expect(isBlockedAuthPath(path)).toBe(true);
  });

  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/admin/impersonate-user",
    "/api/auth/admin/stop-impersonating",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/get-session",
  ])("allows %s", (path) => {
    expect(isBlockedAuthPath(path)).toBe(false);
  });
});
