"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Confirm destructive actions. With `requireReason`, the confirm button stays
 * disabled until a reason is typed and the reason is passed to onConfirm.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive,
  disabled,
  requireReason,
  onConfirm,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  requireReason?: boolean;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("common");
  const [innerOpen, setInnerOpen] = useState(false);
  const [reason, setReason] = useState("");
  const open = controlledOpen ?? innerOpen;
  const setOpen = (v: boolean) => {
    if (!v) setReason("");
    onOpenChange?.(v);
    setInnerOpen(v);
  };
  const blocked = disabled || (requireReason && reason.trim().length === 0);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {requireReason && (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-reason">{t("reason")}</Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              className="rounded-xl"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={() => onConfirm(reason.trim())}
            className={cn(
              "rounded-full",
              destructive &&
                "bg-destructive text-white hover:bg-destructive/90",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
