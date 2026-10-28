import { listPromotions } from "@/features/promotions/queries";
import { apiRoute } from "@/lib/api/handler";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  const ctx = await requireMember({
    roles: OWNER_MANAGER,
    feature: "promotions",
  });
  return listPromotions(ctx.organizationId);
});
