import type { NextRequest } from "next/server";
import { getSalesReport, parseSalesQuery } from "@/features/sales/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireMember } from "@/lib/permissions";

export const GET = apiRoute(async (req: NextRequest) =>
  getSalesReport(
    await requireMember(),
    parseSalesQuery(req.nextUrl.searchParams),
  ),
);
