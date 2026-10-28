"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import { AuditEntryList } from "../../components/audit-entry-list";
import { useCan } from "../../components/backoffice-context";
import { ShopStatusChip } from "../../components/status-chip";
import { changeShopStatus } from "../actions";
import type { ShopDetailDTO } from "../queries";
import { shopActivityKey, useShopActivity } from "./shop-activity-tab";
import { shopKey } from "./shop-detail-view";

export function ShopStatusTab({ shop }: { shop: ShopDetailDTO }) {
  const t = useTranslations("backoffice.shop");
  const { dateTime } = useDateTime();
  const can = useCan();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const activity = useShopActivity(shop.id);
  const [dialog, setDialog] = useState<
    "suspended" | "active" | "closed" | null
  >(null);
  const history = (activity.data ?? []).filter((e) =>
    ["shop.suspend", "shop.reactivate", "shop.close"].includes(e.action),
  );

  async function apply(
    status: "suspended" | "active" | "closed",
    reason: string,
    confirmName?: string,
  ) {
    const r = await changeShopStatus(
      status === "closed"
        ? {
            organizationId: shop.id,
            status,
            reason,
            confirmName: confirmName ?? "",
          }
        : { organizationId: shop.id, status, reason },
    );
    if (!r.ok) {
      toast.error(errorMessage(r.code, r.details));
      return false;
    }
    toast.success(t(`statusChanged.${status}`));
    setDialog(null);
    queryClient.invalidateQueries({ queryKey: shopKey(shop.id) });
    queryClient.invalidateQueries({ queryKey: shopActivityKey(shop.id) });
    queryClient.invalidateQueries({ queryKey: ["backoffice", "shops"] });
    return true;
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {t("currentStatus")}
          </span>
          <ShopStatusChip status={shop.status} />
        </div>
        {shop.statusInfo && (
          <p className="text-muted-foreground text-sm">
            {t("statusChangedBy", {
              name: shop.statusInfo.changedByName ?? "—",
              date: dateTime(shop.statusInfo.changedAt),
            })}
            {shop.statusInfo.reason && (
              <>
                {" · "}
                {t("reason")}: {shop.statusInfo.reason}
              </>
            )}
          </p>
        )}
        <p className="text-muted-foreground text-xs">{t("statusEffect")}</p>
        {can("shop.status") && (
          <div className="flex flex-wrap gap-2">
            {shop.status === "active" && (
              <Button
                variant="outline"
                className="h-10 rounded-full border-warning text-[#9a6608]"
                onClick={() => setDialog("suspended")}
              >
                {t("suspend")}
              </Button>
            )}
            {shop.status !== "active" && (
              <Button
                variant="outline"
                className="h-10 rounded-full border-success text-success"
                onClick={() => setDialog("active")}
              >
                {t("reactivate")}
              </Button>
            )}
            {shop.status !== "closed" && can("shop.close") && (
              <Button
                variant="outline"
                className="h-10 rounded-full border-destructive text-destructive"
                onClick={() => setDialog("closed")}
              >
                {t("close")}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-medium">{t("statusHistory")}</h2>
        {activity.isPending ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <AuditEntryList entries={history} />
        )}
      </section>

      {(dialog === "suspended" || dialog === "active") && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={
            dialog === "suspended" ? t("suspendTitle") : t("reactivateTitle")
          }
          description={
            dialog === "suspended"
              ? t("suspendDescription", { name: shop.name })
              : t("reactivateDescription", { name: shop.name })
          }
          confirmLabel={dialog === "suspended" ? t("suspend") : t("reactivate")}
          destructive={dialog === "suspended"}
          requireReason
          onConfirm={(reason) => void apply(dialog, reason)}
        />
      )}
      {dialog === "closed" && (
        <CloseShopDialog
          shopName={shop.name}
          onCancel={() => setDialog(null)}
          onConfirm={(reason, name) => apply("closed", reason, name)}
        />
      )}
    </div>
  );
}

function CloseShopDialog({
  shopName,
  onCancel,
  onConfirm,
}: {
  shopName: string;
  onCancel: () => void;
  onConfirm: (reason: string, confirmName: string) => Promise<boolean>;
}) {
  const t = useTranslations("backoffice.shop");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = reason.trim() !== "" && name === shopName;
  return (
    <AlertDialog open onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("closeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("closeDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="close-reason">{t("reason")}</Label>
          <Textarea
            id="close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="close-name">
            {t("typeShopName", { name: shopName })}
          </Label>
          <Input
            id="close-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="h-11 rounded-xl"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(reason.trim(), name);
              if (!ok) setBusy(false);
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("close")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
