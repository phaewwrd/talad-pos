"use client";

import { useTranslations } from "next-intl";
import type { ShopStatus } from "@/db/schema";
import type { InviteStatus } from "@/lib/backoffice/invite-status";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-xs";

const SHOP: Record<ShopStatus, string> = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-[#9a6608]",
  closed: "bg-muted text-muted-foreground",
};

const INVITE: Record<InviteStatus, string> = {
  draft: "border border-border bg-transparent text-muted-foreground",
  sent: "bg-gold-soft text-gold-text",
  used: "bg-success/15 text-success",
  expired: "bg-muted text-muted-foreground",
  revoked: "border border-primary bg-transparent text-primary",
};

export function ShopStatusChip({
  status,
  className,
}: {
  status: ShopStatus;
  className?: string;
}) {
  const t = useTranslations("backoffice.shopStatus");
  return <span className={cn(BASE, SHOP[status], className)}>{t(status)}</span>;
}

export function InviteStatusChip({
  status,
  className,
}: {
  status: InviteStatus;
  className?: string;
}) {
  const t = useTranslations("backoffice.inviteStatus");
  return (
    <span className={cn(BASE, INVITE[status], className)}>{t(status)}</span>
  );
}

export function BannedChip({ banned }: { banned: boolean }) {
  const t = useTranslations("backoffice.owners");
  return (
    <span
      className={cn(
        BASE,
        banned
          ? "border border-primary bg-transparent text-primary"
          : "bg-success/15 text-success",
      )}
    >
      {banned ? t("banned") : t("active")}
    </span>
  );
}
