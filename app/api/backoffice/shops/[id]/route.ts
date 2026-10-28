import { getShopDetail } from "@/features/backoffice/shops/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError } from "@/lib/errors";
import { uuid } from "@/lib/schemas";

export const GET = apiRoute(
  async (
    _req: Request,
    { params }: RouteContext<"/api/backoffice/shops/[id]">,
  ) => {
    await requireBackoffice({ roles: rolesFor("view") });
    const id = uuid.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");
    const shop = await getShopDetail(id.data);
    if (!shop) throw new AppError("NOT_FOUND");
    return shop;
  },
);
