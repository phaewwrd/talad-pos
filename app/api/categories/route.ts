import { listCategories } from "@/features/catalog/queries";
import { apiRoute } from "@/lib/api/handler";
import { ANY_MEMBER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  const ctx = await requireMember({ roles: ANY_MEMBER });
  return listCategories(ctx.organizationId);
});
