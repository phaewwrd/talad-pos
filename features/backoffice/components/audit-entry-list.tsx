"use client";

import { ChevronDown, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { useDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AuditDiff } from "./audit-diff";

export type AuditEntry = {
  id: string;
  actorLabel: string;
  action: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** "shop.suspend" → translated label (keys can't contain dots). */
export function useAuditActionLabel() {
  const t = useTranslations("backoffice.auditActions");
  return (action: string) => {
    const key = action.replaceAll(".", "_");
    return t.has(key as never) ? t(key as never) : action;
  };
}

export function AuditEntryList({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("backoffice.audit");
  const label = useAuditActionLabel();
  const { dateTime } = useDateTime();
  const [open, setOpen] = useState<string | null>(null);

  if (entries.length === 0) {
    return <EmptyState icon={ScrollText} title={t("empty")} />;
  }
  return (
    <ol className="grid gap-2">
      {entries.map((e) => (
        <li key={e.id} className="rounded-2xl border bg-card p-3 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid gap-0.5">
              <span className="font-medium text-sm">{label(e.action)}</span>
              <span className="text-muted-foreground text-xs">
                {e.actorLabel} · {dateTime(e.createdAt)}
              </span>
              {e.reason && (
                <span className="text-sm">
                  <span className="text-muted-foreground">{t("reason")}: </span>
                  {e.reason}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full"
              aria-expanded={open === e.id}
              onClick={() => setOpen(open === e.id ? null : e.id)}
            >
              {t("details")}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  open === e.id && "rotate-180",
                )}
              />
            </Button>
          </div>
          {open === e.id && (
            <div className="mt-3">
              <AuditDiff before={e.before} after={e.after} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
