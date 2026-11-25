"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUSES, type OrderStatus } from "@/db/app-schema";
import { classifyTransition, STATUS_FLOW } from "@/lib/orders/status";
import type { MemberRole } from "@/lib/roles";
import { orderUi } from "../permissions";
import type { OrderListItemDTO } from "../types";
import { useOrderMutations } from "../use-order-mutations";

/** Sticky bar shown while orders are selected: change all of them to one status. */
export function BulkStatusBar({
  orgId,
  role,
  userId,
  orders,
  onClear,
}: {
  orgId: string;
  role: MemberRole;
  userId: string;
  orders: OrderListItemDTO[];
  onClear: () => void;
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("orderStatus");
  const m = useOrderMutations(orgId);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Cashiers can only move orders forward, so Cancelled is never offered.
  const options = orderUi.canMoveBackward({ role, userId })
    ? ORDER_STATUSES
    : STATUS_FLOW;

  const kinds = target
    ? orders.map((o) => classifyTransition(o.status, target))
    : [];
  const needsReason = kinds.some((k) => k === "backward" || k === "cancel");
  const cancelling = target === "Cancelled";

  function apply(reason: string) {
    if (!target) return;
    m.bulkStatus.mutate(
      {
        orderIds: orders.map((o) => o.id),
        status: target,
        reason: reason || undefined,
      },
      {
        onSuccess: (r) => {
          toast.success(t("bulkUpdated", r));
          setTarget(null);
          onClear();
        },
      },
    );
    setConfirming(false);
  }

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
      <span className="font-medium text-sm tabular-nums">
        {t("bulkSelected", { count: orders.length })}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select
          value={target ?? ""}
          onValueChange={(v) => setTarget(v as OrderStatus)}
        >
          <SelectTrigger
            className="h-10 w-44 rounded-xl"
            aria-label={t("bulkSetStatus")}
          >
            <SelectValue placeholder={t("bulkSetStatus")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s} value={s}>
                {ts(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="h-10 rounded-full"
          disabled={!target || m.bulkStatus.isPending}
          onClick={() => setConfirming(true)}
        >
          {t("bulkApply")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full"
          onClick={onClear}
          aria-label={t("bulkClear")}
        >
          <X className="size-4" />
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          target
            ? t("bulkStatusTitle", {
                count: orders.length,
                status: ts(target),
              })
            : ""
        }
        description={
          cancelling
            ? t("cancelDescription")
            : needsReason
              ? t("backwardDescription")
              : t("bulkForwardDescription")
        }
        confirmLabel={t("confirm")}
        destructive={cancelling}
        requireReason={needsReason}
        onConfirm={apply}
      />
    </div>
  );
}
