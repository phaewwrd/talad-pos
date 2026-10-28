import { getDashboard } from "@/features/backoffice/dashboard/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";

export const GET = apiRoute(async () => {
  await requireBackoffice({ roles: rolesFor("view") });
  return getDashboard();
});
