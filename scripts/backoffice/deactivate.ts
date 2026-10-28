// pnpm backoffice:deactivate --email cs@talad.app [--reason "left the team"]
// Bans the user and revokes all of their sessions.
import * as z from "zod";
import { deactivateBackofficeUser } from "@/lib/backoffice/accounts";
import { emailArg, runScript } from "./_cli";

runScript(
  z
    .object({ email: emailArg, reason: z.string().trim().max(200).optional() })
    .strict(),
  async (args, ctx) => {
    await deactivateBackofficeUser(args, ctx);
    console.log(`✔ ${args.email} deactivated; all sessions revoked.`);
  },
);
