import { getOrderDetail } from "@/features/orders/queries";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { requireMember } from "@/lib/permissions";
import { uuid } from "@/lib/schemas";

export const GET = apiRoute(
  async (_req: Request, { params }: RouteContext<"/api/orders/[id]">) => {
    const ctx = await requireMember();
    const id = uuid.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");
    return getOrderDetail(ctx, id.data);
  },
);
