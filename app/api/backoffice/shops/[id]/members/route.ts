import {
  listShopDevices,
  listShopMembers,
} from "@/features/backoffice/shops/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError } from "@/lib/errors";
import { uuid } from "@/lib/schemas";

/** Members (never PINs) and trusted devices. */
export const GET = apiRoute(
  async (
    _req: Request,
    { params }: RouteContext<"/api/backoffice/shops/[id]/members">,
  ) => {
    await requireBackoffice({ roles: rolesFor("view") });
    const id = uuid.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");
    const [members, devices] = await Promise.all([
      listShopMembers(id.data),
      listShopDevices(id.data),
    ]);
    return { members, devices };
  },
);
