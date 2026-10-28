import { getPosBootstrap } from "@/features/orders/queries";
import { apiRoute } from "@/lib/api/handler";
import { requireMember } from "@/lib/permissions";

export const GET = apiRoute(async () => getPosBootstrap(await requireMember()));
