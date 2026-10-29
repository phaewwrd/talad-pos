import { listSuppliers } from "@/features/suppliers/queries";
import { apiRoute } from "@/lib/api/handler";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  const ctx = await requireMember({ roles: OWNER_MANAGER });
  return listSuppliers(ctx.organizationId);
});
