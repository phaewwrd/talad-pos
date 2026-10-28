import { listStockMovements } from "@/features/stock/queries";
import { apiRoute } from "@/lib/api/handler";
import { ANY_MEMBER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  const ctx = await requireMember({ roles: ANY_MEMBER });
  return listStockMovements(ctx.organizationId);
});
