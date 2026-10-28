import type { NextRequest } from "next/server";
import { getAllShopsSummary, parseSalesQuery } from "@/features/sales/queries";
import { apiRoute } from "@/lib/api/handler";
import { OWNER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async (req: NextRequest) =>
  getAllShopsSummary(
    await requireMember({ roles: OWNER }),
    parseSalesQuery(req.nextUrl.searchParams),
  ),
);
