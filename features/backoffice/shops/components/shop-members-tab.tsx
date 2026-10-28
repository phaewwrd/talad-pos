"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJson } from "@/lib/api/client";
import { useDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { cn } from "@/lib/utils";
import { useCan } from "../../components/backoffice-context";
import { revokeShopDevice } from "../actions";
import type { ShopDeviceDTO, ShopMemberDTO } from "../queries";

export function ShopMembersTab({ shopId }: { shopId: string }) {
  const t = useTranslations("backoffice.shop");
  const tr = useTranslations("roles");
  const { dateTime } = useDateTime();
  const can = useCan();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<ShopDeviceDTO | null>(null);
  const key = ["backoffice", "shops", shopId, "members"];
  const data = useQuery({
    queryKey: key,
    queryFn: () =>
      getJson<{ members: ShopMemberDTO[]; devices: ShopDeviceDTO[] }>(
        `/api/backoffice/shops/${shopId}/members`,
      ),
  });

  if (data.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  const members = data.data?.members ?? [];
  const devices = data.data?.devices ?? [];

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className="font-medium">{t("members")}</h2>
        {members.length === 0 ? (
          <EmptyState icon={Users} title={t("noMembers")} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("memberName")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("memberStatus")}</TableHead>
                  <TableHead>{t("lastLogin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <span className="grid">
                        <span className="font-medium">{m.name}</span>
                        {m.email && (
                          <span className="text-muted-foreground text-xs">
                            {m.email}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{tr(m.role)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full px-2.5 text-xs",
                          m.active
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {m.active ? t("memberActive") : t("memberInactive")}
                      </span>
                      {m.locked && (
                        <span className="ml-1 text-[#9a6608] text-xs">
                          {t("pinLocked")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {m.lastLoginAt ? dateTime(m.lastLoginAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-medium">{t("devices")}</h2>
        {devices.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title={t("noDevices")} />
        ) : (
          <ul className="grid gap-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-card",
                  d.revokedAt && "opacity-60",
                )}
              >
                <div className="grid gap-0.5">
                  <span className="font-medium text-sm">{d.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("deviceAdded", {
                      date: dateTime(d.createdAt),
                      by: d.createdByName ?? "—",
                    })}
                    {" · "}
                    {t("deviceLastSeen", {
                      date: d.lastSeenAt ? dateTime(d.lastSeenAt) : "—",
                    })}
                  </span>
                </div>
                {d.revokedAt ? (
                  <span className="text-muted-foreground text-xs">
                    {t("deviceRevoked", { date: dateTime(d.revokedAt) })}
                  </span>
                ) : (
                  can("shop.devices.revoke") && (
                    <Button
                      variant="outline"
                      className="h-9 rounded-full text-destructive"
                      onClick={() => setRevoking(d)}
                    >
                      {t("revokeDevice")}
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("revokeDeviceTitle", { name: revoking?.name ?? "" })}
        description={t("revokeDeviceDescription")}
        confirmLabel={t("revokeDevice")}
        destructive
        requireReason
        onConfirm={async (reason) => {
          if (!revoking) return;
          const r = await revokeShopDevice({
            organizationId: shopId,
            deviceId: revoking.id,
            reason,
          });
          setRevoking(null);
          if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
          toast.success(t("deviceRevokedToast"));
          queryClient.invalidateQueries({ queryKey: key });
        }}
      />
    </div>
  );
}
