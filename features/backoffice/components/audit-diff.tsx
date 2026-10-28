"use client";

import { useTranslations } from "next-intl";
import { diffJson } from "@/lib/backoffice/diff";
import { cn } from "@/lib/utils";

function show(v: unknown) {
  if (v === undefined) return "—";
  if (v === null) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Before / after table of an audit entry; changed values highlighted. */
export function AuditDiff({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const t = useTranslations("backoffice.audit");
  const rows = diffJson(before, after);
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noDetails")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/60 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t("field")}</th>
            <th className="px-3 py-2 font-medium">{t("before")}</th>
            <th className="px-3 py-2 font-medium">{t("after")}</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => (
            <tr
              key={r.path}
              className={cn("border-t", r.changed && "bg-gold-soft/50")}
            >
              <td className="px-3 py-1.5 align-top text-muted-foreground">
                {r.path}
              </td>
              <td
                className={cn(
                  "break-all px-3 py-1.5 align-top",
                  r.changed &&
                    "text-primary line-through decoration-primary/40",
                )}
              >
                {show(r.before)}
              </td>
              <td
                className={cn(
                  "break-all px-3 py-1.5 align-top",
                  r.changed && "font-semibold text-success",
                )}
              >
                {show(r.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
