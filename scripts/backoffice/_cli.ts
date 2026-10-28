// Shared CLI plumbing for scripts/backoffice/*: parse `--key value` flags,
// validate them with Zod, run, print a friendly error and exit.
// Run through package.json (tsx --conditions=react-server --env-file=.env).
import { userInfo } from "node:os";
import { basename } from "node:path";
import * as z from "zod";
import {
  AccountScriptError,
  type ScriptContext,
} from "@/lib/backoffice/accounts";
import { BACKOFFICE_ROLES } from "@/lib/backoffice/roles";

export const emailArg = z.email().transform((v) => v.toLowerCase());
export const roleArg = z.enum(BACKOFFICE_ROLES);

function parseFlags(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new AccountScriptError(`Unexpected argument: ${arg}`);
    }
    const eq = arg.indexOf("=");
    if (eq > 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new AccountScriptError(`Missing value for ${arg}`);
      }
      out[arg.slice(2)] = next;
      i++;
    }
  }
  return out;
}

export async function runScript<S extends z.ZodType>(
  schema: S,
  fn: (args: z.output<S>, ctx: ScriptContext) => Promise<void>,
) {
  const script = basename(process.argv[1] ?? "script").replace(/\.ts$/, "");
  try {
    const parsed = schema.safeParse(parseFlags(process.argv.slice(2)));
    if (!parsed.success) {
      console.error(`Invalid arguments:\n${z.prettifyError(parsed.error)}`);
      process.exit(2);
    }
    let osUser = "unknown";
    try {
      osUser = userInfo().username;
    } catch {}
    await fn(parsed.data, { osUser, script: `backoffice:${script}` });
    process.exit(0);
  } catch (err) {
    if (err instanceof AccountScriptError) {
      console.error(`✖ ${err.message}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}
