import { listBackofficeUserOptions } from "@/features/backoffice/invites/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";

/** Backoffice users (id, name, email) for filter dropdowns. */
export const GET = apiRoute(async () => {
  await requireBackoffice({ roles: rolesFor("view") });
  return listBackofficeUserOptions();
});
