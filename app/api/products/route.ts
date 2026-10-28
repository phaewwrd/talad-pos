import type { NextRequest } from "next/server";
import { listProducts } from "@/features/catalog/queries";
import { apiRoute } from "@/lib/api/handler";
import { ANY_MEMBER, requireMember } from "@/lib/permissions";

export const GET = apiRoute(async (req: NextRequest) => {
  const ctx = await requireMember({ roles: ANY_MEMBER });
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  return listProducts(ctx, { activeOnly });
});
