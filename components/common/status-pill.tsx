"use client";

import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/db/app-schema";
import { cn } from "@/lib/utils";

const STYLES: Record<OrderStatus, string> = {
  Pending: "bg-muted text-muted-foreground",
  "In Progress": "bg-warning/15 text-[#9a6608]",
  Ready: "bg-success/15 text-success",
  Completed: "bg-foreground text-background",
  Cancelled: "border border-primary text-primary bg-transparent",
};

export function StatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const t = useTranslations("orderStatus");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-xs",
        STYLES[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
