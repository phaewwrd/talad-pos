import { listInviteEmailLogs } from "@/features/backoffice/invites/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError } from "@/lib/errors";
import { uuid } from "@/lib/schemas";

export const GET = apiRoute(
  async (
    _req: Request,
    { params }: RouteContext<"/api/backoffice/invites/[id]/emails">,
  ) => {
    await requireBackoffice({ roles: rolesFor("view") });
    const id = uuid.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");
    return listInviteEmailLogs(id.data);
  },
);
