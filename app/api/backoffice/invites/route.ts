import { listInvites } from "@/features/backoffice/invites/queries";
import { inviteListSchema } from "@/features/backoffice/invites/schemas";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { parseQuery } from "@/lib/backoffice/list-params";
import { rolesFor } from "@/lib/backoffice/permissions";

export const GET = apiRoute(async (request: Request) => {
  await requireBackoffice({ roles: rolesFor("view") });
  return listInvites(parseQuery(request, inviteListSchema));
});
