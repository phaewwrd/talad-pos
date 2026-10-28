import type { BetterAuthClientPlugin } from "better-auth/client";
import type { pinLogin } from "./pin-plugin";

export const pinLoginClient = () =>
  ({
    id: "talad-pin-login",
    $InferServerPlugin: {} as ReturnType<typeof pinLogin>,
  }) satisfies BetterAuthClientPlugin;
