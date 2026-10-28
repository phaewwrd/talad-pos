// pnpm backoffice:set-role --email cs@talad.app --role support
import * as z from "zod";
import { setBackofficeRole } from "@/lib/backoffice/accounts";
import { emailArg, roleArg, runScript } from "./_cli";

runScript(
  z.object({ email: emailArg, role: roleArg }).strict(),
  async (args, ctx) => {
    await setBackofficeRole(args, ctx);
    console.log(`✔ ${args.email} is now ${args.role} (sessions revoked).`);
  },
);
