"use client";

import { CircleCheck, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMoney } from "@/lib/format";

export type PlacedOrder = {
  id: string;
  orderNumber: string;
  total: string;
  paymentType: "Paid" | "Unpaid";
  changeAmount: string | null;
};

export function OrderSuccessDialog({
  order,
  onClose,
}: {
  order: PlacedOrder | null;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const locale = useLocale();
  const money = useMoney();
  return (
    <Dialog open={order !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl text-center sm:max-w-sm">
        {order && (
          <>
            <DialogHeader className="items-center">
              <CircleCheck className="size-14 text-success" aria-hidden />
              <DialogTitle className="text-xl">{t("orderPlaced")}</DialogTitle>
              <DialogDescription className="tabular-nums">
                {order.orderNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1 rounded-2xl bg-muted/60 p-4">
              <p className="text-muted-foreground text-sm">{t("total")}</p>
              <p className="font-bold text-2xl text-gold-text tabular-nums">
                {money(order.total)}
              </p>
              {order.changeAmount !== null && (
                <p className="font-semibold text-lg text-success tabular-nums">
                  {t("changeDue", { amount: money(order.changeAmount) })}
                </p>
              )}
              {order.paymentType === "Unpaid" && (
                <p className="text-sm text-warning">{t("unpaidNote")}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-12 rounded-full"
                onClick={() =>
                  window.open(
                    `/${locale}/receipt/${order.id}`,
                    "_blank",
                    "noopener",
                  )
                }
              >
                <Printer className="size-4" /> {t("printReceipt")}
              </Button>
              <Button className="h-12 rounded-full" onClick={onClose} autoFocus>
                {t("newOrder")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
