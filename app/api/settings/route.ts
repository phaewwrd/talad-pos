import {
  getSettings,
  listDevices,
  listOwnedShops,
  listStaff,
} from "@/features/settings/queries";
import { apiRoute } from "@/lib/api/handler";
import { getUserEntitlements } from "@/lib/entitlements";
import { OWNER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => {
  const ctx = await requireMember({ roles: OWNER });
  const [settings, staff, devices, shops, entitlements] = await Promise.all([
    getSettings(ctx.organizationId),
    listStaff(ctx.organizationId),
    listDevices(ctx.organizationId),
    listOwnedShops(ctx.user.id),
    getUserEntitlements(ctx.user.id),
  ]);
  return {
    settings,
    staff,
    devices,
    shops,
    entitlements,
    activeShopId: ctx.organizationId,
  };
});
