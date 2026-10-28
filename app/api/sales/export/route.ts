import ExcelJS from "exceljs";
import { connection, type NextRequest, NextResponse } from "next/server";
import { getSalesExportRows, parseSalesQuery } from "@/features/sales/queries";
import { AppError } from "@/lib/errors";
import { requireMember } from "@/lib/permissions";
import { SHOP_TIME_ZONE } from "@/lib/time";

const HEADERS = [
  "order_number",
  "created_at",
  "channel",
  "customer",
  "status",
  "payment_type",
  "payment_method",
  "subtotal",
  "discount",
  "service_charge",
  "vat",
  "total",
  "staff",
] as const;

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/** CSV / XLSX export of the sales range (feature-gated). */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const ctx = await requireMember({ feature: "export" });
    const format =
      req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const { range, rows } = await getSalesExportRows(
      ctx,
      parseSalesQuery(req.nextUrl.searchParams),
    );
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: SHOP_TIME_ZONE,
      dateStyle: "short",
      timeStyle: "short",
    });
    const values = rows.map((r) => [
      r.orderNumber,
      fmt.format(r.createdAt),
      r.channel,
      r.customer,
      r.status,
      r.paymentType,
      r.paymentMethod ?? "",
      r.subtotal,
      r.discount,
      r.serviceCharge,
      r.vat,
      r.total,
      r.staff ?? "",
    ]);
    const filename = `sales_${range.from}_${range.to}.${format}`;

    if (format === "csv") {
      // BOM so Excel opens Thai text as UTF-8.
      const body = `﻿${[HEADERS.join(","), ...values.map((r) => r.map(csvCell).join(","))].join("\n")}`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sales");
    ws.addRow([...HEADERS]).font = { bold: true };
    for (const r of values) {
      // Money columns as numbers for spreadsheet math (already 2dp).
      ws.addRow(r.map((v, i) => (i >= 7 && i <= 11 ? Number(v) : v)));
    }
    for (const col of [8, 9, 10, 11, 12]) ws.getColumn(col).numFmt = "#,##0.00";
    ws.columns.forEach((c) => {
      c.width = 16;
    });
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { code: err.code },
        { status: err.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw err;
  }
}
