// pnpm backoffice:reactivate --email cs@talad.app
import * as z from "zod";
import { reactivateBackofficeUser } from "@/lib/backoffice/accounts";
import { emailArg, runScript } from "./_cli";

runScript(z.object({ email: emailArg }).strict(), async (args, ctx) => {
  await reactivateBackofficeUser(args, ctx);
  console.log(`✔ ${args.email} reactivated.`);
});
