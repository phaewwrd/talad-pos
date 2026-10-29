"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupplierDTO } from "../types";
import { useRun } from "../use-run";

export function PinDialog({
  orgId,
  open,
  onOpenChange,
  supplier,
  onSave,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierDTO;
  onSave: (
    pin: string,
  ) => Promise<
    | { ok: true }
    | { ok: false; code: string; details?: Record<string, string | number> }
  >;
}) {
  const t = useTranslations("suppliers");
  const run = useRun(orgId);
  const [pin, setPin] = useState("");
  const close = (o: boolean) => {
    if (!o) setPin("");
    onOpenChange(o);
  };
  const id = `supplier-pin-${supplier.id}`;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>
            {supplier.link.hasPin ? t("changePin") : t("setPin")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={id}>{t("pin")}</Label>
          <Input
            id={id}
            inputMode="numeric"
            type="password"
            autoComplete="new-password"
            value={pin}
            maxLength={6}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-xl"
          />
          <p className="text-muted-foreground text-xs">{t("pinHint")}</p>
        </div>
        <Button
          className="h-12 rounded-full"
          disabled={!/^\d{4,6}$/.test(pin)}
          onClick={async () => {
            if (await run(onSave(pin), t("pinSaved"))) close(false);
          }}
        >
          {t("savePin")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
