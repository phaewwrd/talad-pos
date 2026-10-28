import { connection, NextResponse } from "next/server";
import { exportShops } from "@/features/backoffice/shops/queries";
import { shopListSchema } from "@/features/backoffice/shops/schemas";
import { csvResponse, toCsv } from "@/lib/backoffice/csv";
import { requireBackoffice } from "@/lib/backoffice/guard";
import { parseQuery } from "@/lib/backoffice/list-params";
import { rolesFor } from "@/lib/backoffice/permissions";
import { AppError } from "@/lib/errors";
import { bangkokDateString } from "@/lib/time";

export async function GET(request: Request) {
  await connection();
  try {
    await requireBackoffice({ roles: rolesFor("view") });
    const rows = await exportShops(parseQuery(request, shopListSchema));
    const csv = toCsv(
      [
        "shop_id",
        "shop_name",
        "owner_email",
        "status",
        "staff_used",
        "staff_limit",
        "products_used",
        "products_limit",
        "orders_30d",
        "gmv_30d_thb",
        "created_at",
        "last_activity_at",
      ],
      rows.map((r) => [
        r.id,
        r.name,
        r.owner?.email ?? "",
        r.status,
        r.staff.used,
        r.staff.limit ?? "unlimited",
        r.products.used,
        r.products.limit ?? "unlimited",
        r.orders30d,
        r.gmv30d,
        r.createdAt,
        r.lastActivityAt ?? "",
      ]),
    );
    return csvResponse(`shops-${bangkokDateString(new Date())}.csv`, csv);
  } catch (err) {
    if (err instanceof AppError) {
      const status =
        err.code === "UNAUTHORIZED" || err.code === "SESSION_EXPIRED"
          ? 401
          : err.code === "VALIDATION"
            ? 400
            : 403;
      return NextResponse.json({ code: err.code }, { status });
    }
    throw err;
  }
}
