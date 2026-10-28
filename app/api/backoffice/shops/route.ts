import { listShops } from "@/features/backoffice/shops/queries";
import { shopListSchema } from "@/features/backoffice/shops/schemas";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { parseQuery } from "@/lib/backoffice/list-params";
import { rolesFor } from "@/lib/backoffice/permissions";

export const GET = apiRoute(async (request: Request) => {
  await requireBackoffice({ roles: rolesFor("view") });
  return listShops(parseQuery(request, shopListSchema));
});
