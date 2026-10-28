import type { NextRequest } from "next/server";
import { listEntries } from "@/features/cost-profit/queries";
import { parseSalesQuery } from "@/features/sales/queries";
import { apiRoute } from "@/lib/api/handler";
import { OWNER, requireMember } from "@/lib/permissions";
import { resolveRange } from "@/lib/sales/range";

export const GET = apiRoute(async (req: NextRequest) => {
  const ctx = await requireMember({ roles: OWNER, feature: "costProfit" });
  const q = parseSalesQuery(req.nextUrl.searchParams);
  return listEntries(ctx.organizationId, resolveRange(q.preset, new Date(), q));
});
