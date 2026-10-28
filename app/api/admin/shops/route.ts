import { shopsOverview } from "@/features/admin/queries";
import { apiRoute } from "@/lib/api/handler";
import { requirePlatformAdmin } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  await requirePlatformAdmin();
  return shopsOverview();
});
