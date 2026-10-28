"use client";

import { useQuery } from "@tanstack/react-query";
import { MailX } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/api/client";
import { useDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InviteDTO, InviteEmailLogDTO } from "../queries";

const STATUS_STYLE = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-success/15 text-success",
  failed: "border border-primary text-primary",
} as const;

export function DeliveryLogSheet({
  invite,
  onClose,
}: {
  invite: InviteDTO;
  onClose: () => void;
}) {
  const t = useTranslations("backoffice.invites");
  const { dateTime } = useDateTime();
  const logs = useQuery({
    queryKey: ["backoffice", "invites", invite.id, "emails"],
    queryFn: () =>
      getJson<InviteEmailLogDTO[]>(
        `/api/backoffice/invites/${invite.id}/emails`,
      ),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("deliveryLog")}</SheetTitle>
          <SheetDescription>{invite.label}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-6">
          {logs.isPending ? (
            Array.from({ length: 3 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))
          ) : !logs.data?.length ? (
            <EmptyState icon={MailX} title={t("noDeliveries")} />
          ) : (
            <ol className="grid gap-2">
              {logs.data.map((log) => (
                <li key={log.id} className="grid gap-1 rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-2.5 font-medium text-xs",
                        STATUS_STYLE[log.status],
                      )}
                    >
                      {t(`emailStatus.${log.status}`)}
                    </span>
                    <time className="text-muted-foreground text-xs tabular-nums">
                      {dateTime(log.createdAt)}
                    </time>
                  </div>
                  <p className="text-sm">{log.toEmail}</p>
                  {log.sentByName && (
                    <p className="text-muted-foreground text-xs">
                      {t("sentBy", { name: log.sentByName })}
                    </p>
                  )}
                  {log.providerMessageId && (
                    <p className="break-all font-mono text-[11px] text-muted-foreground">
                      {log.providerMessageId}
                    </p>
                  )}
                  {log.error && (
                    <p className="break-words text-destructive text-xs">
                      {log.error}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
