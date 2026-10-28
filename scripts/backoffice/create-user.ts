// pnpm backoffice:create-user --email dev@talad.app --name "Dev Name" --role super_admin [--password "..."]
// Idempotent: an existing backoffice user gets the new name/role (and password, if given).
import * as z from "zod";
import { createBackofficeUser } from "@/lib/backoffice/accounts";
import { emailArg, roleArg, runScript } from "./_cli";

runScript(
  z
    .object({
      email: emailArg,
      name: z.string().trim().min(1).max(100),
      role: roleArg,
      password: z.string().min(12).max(128).optional(),
    })
    .strict(),
  async (args, ctx) => {
    const r = await createBackofficeUser(args, ctx);
    console.log(
      r.created
        ? `✔ Created ${args.email} (${args.role}).`
        : `✔ Updated ${args.email} (${args.role}).`,
    );
    if (r.generatedPassword) {
      // Printed once; the user must change it at first login.
      console.log(`  Temporary password: ${r.generatedPassword}`);
      console.log("  (shown only now — it must be changed at first login)");
    }
  },
);
