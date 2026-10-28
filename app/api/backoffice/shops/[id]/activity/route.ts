import {
  listShopActivity,
  shopOwnerId,
} from "@/features/backoffice/shops/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError } from "@/lib/errors";
import { uuid } from "@/lib/schemas";

export const GET = apiRoute(
  async (
    _req: Request,
    { params }: RouteContext<"/api/backoffice/shops/[id]/activity">,
  ) => {
    await requireBackoffice({ roles: rolesFor("view") });
    const id = uuid.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");
    return listShopActivity(id.data, await shopOwnerId(id.data));
  },
);
