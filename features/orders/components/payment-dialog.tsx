"use client";

import { Banknote, Loader2, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PromptPayQr } from "@/components/common/promptpay-qr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/lib/format";
import { money as toDecimal, toMoneyString } from "@/lib/money";
import type { PaymentInput } from "../schemas";

const QUICK_NOTES = ["100", "500", "1000"] as const;

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  promptpayId,
  onConfirm,
  pending,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: string;
  promptpayId: string | null;
  onConfirm: (payment: PaymentInput) => void;
  pending: boolean;
  title?: string;
}) {
  const t = useTranslations("payment");
  const format = useMoney();
  const [method, setMethod] = useState<PaymentInput["method"]>("cash");
  const [received, setReceived] = useState("");

  const receivedValid = /^\d{1,10}(\.\d{1,2})?$/.test(received);
  const change = receivedValid ? toDecimal(received).minus(total) : null;
  const enough = change !== null && !change.isNegative();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setReceived("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-gold-soft p-4 text-center">
          <p className="text-muted-foreground text-sm">{t("amountDue")}</p>
          <p className="font-bold text-3xl text-gold-text tabular-nums">
            {format(total)}
          </p>
        </div>
        <Tabs
          value={method}
          onValueChange={(v) => setMethod(v as PaymentInput["method"])}
        >
          <TabsList className="grid h-12 w-full grid-cols-2 rounded-full p-1">
            <TabsTrigger value="cash" className="rounded-full">
              <Banknote className="size-4" /> {t("cash")}
            </TabsTrigger>
            <TabsTrigger value="promptpay" className="rounded-full">
              <QrCode className="size-4" /> {t("promptpay")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cash" className="grid gap-3 pt-3">
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl"
                onClick={() => setReceived(toMoneyString(total))}
              >
                {t("exact")}
              </Button>
              {QUICK_NOTES.map((note) => (
                <Button
                  key={note}
                  type="button"
                  variant="outline"
                  className="h-12 rounded-xl tabular-nums"
                  disabled={toDecimal(note).lessThan(total)}
                  onClick={() => setReceived(note)}
                >
                  ฿{note}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-received">{t("cashReceived")}</Label>
              <Input
                id="cash-received"
                inputMode="decimal"
                value={received}
                onChange={(e) =>
                  setReceived(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder={toMoneyString(total)}
                className="h-14 rounded-xl text-right font-semibold text-2xl tabular-nums"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-muted-foreground">{t("change")}</span>
              <span
                className={`font-bold text-xl tabular-nums ${enough ? "text-success" : "text-muted-foreground"}`}
              >
                {change && enough ? format(change.toFixed(2)) : "—"}
              </span>
            </div>
            <Button
              className="h-14 rounded-full font-semibold text-base"
              disabled={!enough || pending}
              onClick={() =>
                onConfirm({
                  method: "cash",
                  cashReceived: toMoneyString(received),
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("confirmCash")}
            </Button>
          </TabsContent>
          <TabsContent
            value="promptpay"
            className="grid justify-items-center gap-3 pt-3"
          >
            {promptpayId ? (
              <>
                <PromptPayQr
                  promptpayId={promptpayId}
                  amount={total}
                  label={t("qrLabel", { amount: format(total) })}
                />
                <p className="text-muted-foreground text-sm">
                  {t("scanToPay")}
                </p>
              </>
            ) : (
              <p className="rounded-xl bg-primary-soft p-3 text-center text-primary text-sm">
                {t("noPromptpayId")}
              </p>
            )}
            <Button
              className="h-14 w-full rounded-full font-semibold text-base"
              disabled={pending}
              onClick={() => onConfirm({ method: "promptpay" })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t("confirmPromptpay")}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
