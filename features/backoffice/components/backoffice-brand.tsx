import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Talad POS mark + gold "Backoffice" badge, so it is never mistaken for a shop. */
export function BackofficeBrand({ className }: { className?: string }) {
  const t = useTranslations("backoffice");
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold text-white"
      >
        ต
      </span>
      <span className="font-semibold text-white">Talad POS</span>
      <span className="rounded-full bg-gold px-2.5 py-0.5 font-semibold text-[11px] text-topbar uppercase tracking-wide">
        {t("badge")}
      </span>
    </span>
  );
}
