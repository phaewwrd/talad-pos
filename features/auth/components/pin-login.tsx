"use client";

import { ArrowLeft, Delete, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { useErrorMessage } from "@/lib/use-error-message";
import { cn } from "@/lib/utils";
import type { PinStaff } from "../queries";

const MAX_PIN = 6;
const MIN_PIN = 4;

export function PinLogin({ staff }: { staff: PinStaff[] }) {
  const t = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [selected, setSelected] = useState<PinStaff | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(value = pin) {
    if (!selected || value.length < MIN_PIN || pending) return;
    setPending(true);
    setError(null);
    const { error: err } = await authClient.pin.signIn({
      userId: selected.id,
      pin: value,
    });
    if (err) {
      setPending(false);
      setPin("");
      const extra = err as unknown as {
        attemptsLeft?: number;
        lockedUntil?: string;
      };
      if (
        err.code === "PIN_INVALID" &&
        typeof extra.attemptsLeft === "number"
      ) {
        setError(t("pinAttemptsLeft", { count: extra.attemptsLeft }));
      } else if (err.code === "PIN_LOCKED" && extra.lockedUntil) {
        setError(
          t("pinLockedUntil", {
            time: format.dateTime(new Date(extra.lockedUntil), {
              timeStyle: "short",
            }),
          }),
        );
      } else {
        setError(errorMessage(err.code));
      }
      return;
    }
    router.replace("/pos");
    router.refresh();
  }

  function press(digit: string) {
    if (pending || pin.length >= MAX_PIN) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === MAX_PIN) void submit(next);
  }

  if (!selected) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {staff.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setSelected(s)}
              className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 transition-colors hover:border-primary focus-visible:border-primary"
            >
              <Avatar className="size-14">
                {s.image && <AvatarImage src={s.image} alt="" />}
                <AvatarFallback className="bg-gold-soft font-semibold text-gold-text text-lg">
                  {s.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="line-clamp-1 font-medium">{s.name}</span>
              <span className="text-muted-foreground text-xs">
                {tRoles(s.role)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setPin("");
          setError(null);
        }}
        className="flex min-h-11 items-center gap-2 text-muted-foreground text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {selected.name}
      </button>
      <p className="text-center font-medium">
        {t("enterPin", { name: selected.name })}
      </p>
      <div className="flex justify-center gap-3" aria-hidden>
        {Array.from({ length: MAX_PIN }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length dots
            key={i}
            className={cn(
              "size-3.5 rounded-full border-2 border-foreground/30",
              i < pin.length && "border-primary bg-primary",
            )}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {pin.length}/{MAX_PIN}
      </p>
      <p role="alert" className="min-h-5 text-center text-destructive text-sm">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PinKey
            key={d}
            label={t("pinDigit", { digit: d })}
            onClick={() => press(d)}
          >
            {d}
          </PinKey>
        ))}
        <PinKey
          label={t("pinClear")}
          onClick={() => setPin((p) => p.slice(0, -1))}
        >
          <Delete className="size-6" aria-hidden />
        </PinKey>
        <PinKey
          label={t("pinDigit", { digit: "0" })}
          onClick={() => press("0")}
        >
          0
        </PinKey>
        <Button
          type="button"
          onClick={() => submit()}
          disabled={pin.length < MIN_PIN || pending}
          aria-label={t("pinSubmit")}
          className="h-16 rounded-2xl text-base"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : "OK"}
        </Button>
      </div>
    </div>
  );
}

function PinKey({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-16 items-center justify-center rounded-2xl border bg-card font-semibold text-2xl tabular-nums active:bg-muted"
    >
      {children}
    </button>
  );
}
