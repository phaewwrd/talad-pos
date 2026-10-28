"use client";

import {
  ArrowRightLeft,
  CreditCard,
  Eye,
  MoreHorizontal,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORDER_STATUSES, type OrderStatus } from "@/db/app-schema";
import { usePosBootstrap } from "@/features/pos/hooks";
import { Link } from "@/i18n/navigation";
import { classifyTransition } from "@/lib/orders/status";
import type { MemberRole } from "@/lib/roles";
import { orderUi } from "../permissions";
import type { OrderListItemDTO } from "../types";
import { useOrderMutations } from "../use-order-mutations";
import { EditOrderSheet } from "./edit-order-sheet";
import { PaymentDialog } from "./payment-dialog";

export function OrderActions({
  orgId,
  order,
  role,
  userId,
  showView = true,
  variant = "icon",
}: {
  orgId: string;
  order: OrderListItemDTO;
  role: MemberRole;
  userId: string;
  showView?: boolean;
  variant?: "icon" | "buttons";
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("orderStatus");
  const locale = useLocale();
  const viewer = { role, userId };
  const m = useOrderMutations(orgId);
  const pos = usePosBootstrap(orgId);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const deleted = Boolean(order.deletedAt);
  const statuses = ORDER_STATUSES.filter((s) => {
    const kind = classifyTransition(order.status, s);
    if (kind === "forward") return true;
    if (kind === "backward" || kind === "cancel")
      return orderUi.canMoveBackward(viewer);
    return false;
  });

  function requestStatus(status: OrderStatus) {
    const kind = classifyTransition(order.status, status);
    if (kind === "forward") m.status.mutate({ orderId: order.id, status });
    else setPendingStatus(status); // backward / cancel: ask for a reason
  }

  const print = () =>
    window.open(`/${locale}/receipt/${order.id}`, "_blank", "noopener");

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "icon" ? "ghost" : "outline"}
          size={variant === "icon" ? "icon" : "default"}
          className={
            variant === "icon" ? "size-10 rounded-full" : "h-11 rounded-full"
          }
          aria-label={t("actions")}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
          {variant === "buttons" && t("more")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={(e) => e.stopPropagation()}
      >
        {showView && (
          <DropdownMenuItem asChild>
            <Link href={`/orders/${order.id}`}>
              <Eye className="size-4" /> {t("view")}
            </Link>
          </DropdownMenuItem>
        )}
        {!deleted && orderUi.canEdit(viewer, order) && (
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" /> {t("edit")}
          </DropdownMenuItem>
        )}
        {!deleted && statuses.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft className="size-4" /> {t("changeStatus")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {statuses.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => requestStatus(s)}>
                  {ts(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {orderUi.canTakePayment(order) && (
          <DropdownMenuItem onSelect={() => setPaying(true)}>
            <CreditCard className="size-4" /> {t("takePayment")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={print}>
          <Printer className="size-4" /> {t("print")}
        </DropdownMenuItem>
        {!deleted && orderUi.canCancelOrDelete(viewer) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleting(true)}
            >
              <Trash2 className="size-4" /> {t("delete")}
            </DropdownMenuItem>
          </>
        )}
        {deleted && orderUi.canRestore(viewer) && (
          <DropdownMenuItem
            onSelect={() =>
              m.restore.mutate(order.id, {
                onSuccess: () => toast.success(t("restored")),
              })
            }
          >
            <RotateCcw className="size-4" /> {t("restore")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {variant === "buttons" ? (
        <div className="flex flex-wrap gap-2">
          {orderUi.canTakePayment(order) && (
            <Button
              className="h-11 rounded-full"
              onClick={() => setPaying(true)}
            >
              <CreditCard className="size-4" /> {t("takePayment")}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11 rounded-full"
            onClick={print}
          >
            <Printer className="size-4" /> {t("print")}
          </Button>
          {menu}
        </div>
      ) : (
        menu
      )}

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        total={order.total}
        promptpayId={pos.data?.pricing.promptpayId ?? null}
        pending={m.payment.isPending}
        title={`${t("takePayment")} · ${order.orderNumber}`}
        onConfirm={(payment) =>
          m.payment.mutate(
            { orderId: order.id, payment },
            {
              onSuccess: () => {
                setPaying(false);
                toast.success(t("paid"));
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteTitle", { number: order.orderNumber })}
        description={t("deleteDescription")}
        confirmLabel={t("delete")}
        destructive
        requireReason
        onConfirm={(reason) =>
          m.remove.mutate(
            { orderId: order.id, reason },
            { onSuccess: () => toast.success(t("deleted")) },
          )
        }
      />
      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={
          pendingStatus ? t("statusTitle", { status: ts(pendingStatus) }) : ""
        }
        description={
          pendingStatus === "Cancelled"
            ? t("cancelDescription")
            : t("backwardDescription")
        }
        confirmLabel={t("confirm")}
        destructive={pendingStatus === "Cancelled"}
        requireReason
        onConfirm={(reason) => {
          if (pendingStatus)
            m.status.mutate({
              orderId: order.id,
              status: pendingStatus,
              reason,
            });
          setPendingStatus(null);
        }}
      />
      {editing && (
        <EditOrderSheet
          orgId={orgId}
          orderId={order.id}
          needsReason={orderUi.editNeedsReason(viewer, order)}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
