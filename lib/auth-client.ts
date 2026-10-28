import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { pinLoginClient } from "@/lib/auth/pin-client";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    adminClient(),
    twoFactorClient(),
    pinLoginClient(),
  ],
});
