"use client";

import { useTranslations } from "next-intl";
import type { BackofficeRole } from "@/lib/backoffice/roles";
import { cn } from "@/lib/utils";

export function RoleChip({
  role,
  className,
}: {
  role: BackofficeRole;
  className?: string;
}) {
  const t = useTranslations("backoffice.roles");
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 font-medium text-[11px]",
        role === "super_admin"
          ? "bg-gold text-topbar"
          : "border border-gold/60 text-gold",
        className,
      )}
    >
      {t(role)}
    </span>
  );
}
