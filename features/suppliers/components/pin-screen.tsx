"use client";

import { Delete, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { verifySupplierPin } from "../public-actions";
import { LinkUnavailable } from "./link-unavailable";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function PinScreen({ token }: { token: string }) {
  const t = useTranslations("supplierView");
  const router = useRouter();
  const { time } = useDateTime();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (gone) return <LinkUnavailable />;

  const locked = lockedUntil !== null && new Date(lockedUntil) > new Date();

  function press(digit: string) {
    if (pin.length < 6) setPin(pin + digit);
    setError(null);
  }

  function submit() {
    if (!/^\d{4,6}$/.test(pin) || pending || locked) return;
    startTransition(async () => {
      const r = await verifySupplierPin({ token, pin });
      setPin("");
      if (r.ok) return router.refresh();
      if (r.code === "NOT_FOUND") return setGone(true);
      if (r.code === "PIN_LOCKED") {
        setLockedUntil(String(r.details?.lockedUntil ?? ""));
        return setError(null);
      }
      setError(
        typeof r.details?.attemptsLeft === "number"
          ? t("pinWrong", { count: r.details.attemptsLeft })
          : t("pinWrongGeneric"),
      );
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-xs gap-6 py-6">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold-text">
          <Lock className="size-5" aria-hidden />
        </span>
        <h1 className="font-semibold text-lg">{t("pinTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("pinHint")}</p>
      </div>

      <div
        className="flex justify-center gap-3"
        role="img"
        aria-label={t("pinEntered", { count: pin.length })}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 border-foreground/40",
              i < pin.length && "border-foreground bg-foreground",
            )}
          />
        ))}
      </div>

      <p
        className="min-h-5 text-center text-primary text-sm"
        role="alert"
        aria-live="assertive"
      >
        {locked
          ? t("pinLocked", { time: time(lockedUntil ?? "") })
          : (error ?? "")}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <KeyButton key={k} onClick={() => press(k)} disabled={locked}>
            {k}
          </KeyButton>
        ))}
        <KeyButton
          onClick={() => setPin(pin.slice(0, -1))}
          disabled={locked || pin.length === 0}
          aria-label={t("pinDelete")}
        >
          <Delete className="size-5" aria-hidden />
        </KeyButton>
        <KeyButton onClick={() => press("0")} disabled={locked}>
          0
        </KeyButton>
        <span />
      </div>

      <Button
        className="h-12 rounded-full"
        disabled={pin.length < 4 || pending || locked}
        onClick={submit}
      >
        {t("pinSubmit")}
      </Button>
    </div>
  );
}

function KeyButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 items-center justify-center rounded-2xl border bg-card font-medium text-xl shadow-card transition-colors active:bg-muted disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
