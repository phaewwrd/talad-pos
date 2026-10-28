// pnpm backoffice:list
import * as z from "zod";
import { listBackofficeUsers } from "@/lib/backoffice/accounts";
import { runScript } from "./_cli";

const fmt = (d: Date | null) =>
  d
    ? d.toLocaleString("en-GB", { timeZone: "Asia/Bangkok", hour12: false })
    : "—";

runScript(z.object({}).strict(), async () => {
  const users = await listBackofficeUsers();
  if (users.length === 0) {
    console.log(
      "No backoffice users. Create one with pnpm backoffice:create-user.",
    );
    return;
  }
  console.table(
    users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      "2fa": u.twoFactorEnabled ? "yes" : "no",
      status: u.banned ? "deactivated" : "active",
      "must change pw": u.mustChangePassword ? "yes" : "",
      "last login (BKK)": fmt(u.lastLoginAt),
      "created (BKK)": fmt(u.createdAt),
    })),
  );
});
