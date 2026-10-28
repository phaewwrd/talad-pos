"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/backoffice/audit";
import { requestMeta } from "@/lib/backoffice/guard";
import { AppError, runAction } from "@/lib/errors";
import { getAuthSession } from "@/lib/permissions";

/**
 * "Stop" on the shop app's impersonation banner: end the owner session and
 * restore the backoffice session (Better Auth stopImpersonating).
 */
export async function stopImpersonation() {
  return runAction(async () => {
    const current = await getAuthSession();
    const adminId = current?.session.impersonatedBy;
    if (!current || !adminId) throw new AppError("INVALID_STATE");
    const organizationId = current.session.activeOrganizationId;

    await auth.api.stopImpersonating({ headers: await headers() });

    const [admin] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, adminId));
    const meta = await requestMeta();
    await db.transaction(async (tx) => {
      await writeAudit(tx, {
        actor: { id: adminId, label: admin?.email ?? adminId },
        ...meta,
        action: "user.impersonate.stop",
        targetType: "user",
        targetId: current.user.id,
        after: { organizationId, impersonationSessionId: current.session.id },
      });
    });
    return {
      redirectTo: organizationId
        ? `/backoffice/shops/${organizationId}`
        : "/backoffice",
    };
  });
}
