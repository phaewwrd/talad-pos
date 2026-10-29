// Used by proxy.ts for /[locale]/s/<token>: answers unknown, disabled and
// regenerated links with a 404 before rendering starts. The page and the
// stock API still check the link again on every request.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplierShareLinks } from "@/db/schema";

export async function isSupplierLinkAvailable(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [row] = await db
    .select({ id: supplierShareLinks.id })
    .from(supplierShareLinks)
    .where(
      and(
        eq(supplierShareLinks.token, token),
        eq(supplierShareLinks.isEnabled, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}
