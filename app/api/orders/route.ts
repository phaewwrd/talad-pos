import type { NextRequest } from "next/server";
import { listOrders } from "@/features/orders/queries";
import { orderFiltersSchema } from "@/features/orders/schemas";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { requireMember } from "@/lib/permissions";

export const GET = apiRoute(async (req: NextRequest) => {
  const ctx = await requireMember();
  const filters = orderFiltersSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!filters.success) throw new AppError("VALIDATION");
  return listOrders(ctx, filters.data);
});
