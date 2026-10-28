import { listOwners } from "@/features/backoffice/owners/queries";
import { ownerListSchema } from "@/features/backoffice/owners/schemas";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { parseQuery } from "@/lib/backoffice/list-params";
import { rolesFor } from "@/lib/backoffice/permissions";

export const GET = apiRoute(async (request: Request) => {
  await requireBackoffice({ roles: rolesFor("view") });
  return listOwners(parseQuery(request, ownerListSchema));
});
