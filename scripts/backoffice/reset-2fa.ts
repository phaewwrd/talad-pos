// pnpm backoffice:reset-2fa --email cs@talad.app
// Removes TOTP and backup codes and signs the user out; the next login re-enrolls.
import * as z from "zod";
import { resetBackofficeTwoFactor } from "@/lib/backoffice/accounts";
import { emailArg, runScript } from "./_cli";

runScript(z.object({ email: emailArg }).strict(), async (args, ctx) => {
  await resetBackofficeTwoFactor(args, ctx);
  console.log(
    `✔ 2FA reset for ${args.email}; they must enroll again at login.`,
  );
});
