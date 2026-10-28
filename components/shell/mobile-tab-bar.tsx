"use client";

import { LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import type { MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { isActivePath, navItemsFor } from "./nav-items";
import { useLogout } from "./use-logout";

export function MobileTabBar({ role }: { role: MemberRole }) {
  const items = navItemsFor(role);
  const t = useTranslations("nav");
  const pathname = usePathname();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const primary = items.filter((i) => i.primary);
  const more = items.filter((i) => !i.primary);
  const moreActive = more.some((i) => isActivePath(pathname, i.href));

  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-sidebar-foreground",
      active && "text-sidebar-active",
    );

  return (
    <nav
      aria-label={t("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 flex bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {primary.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
          >
            <item.icon className="size-5" aria-hidden />
            {t(item.key)}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={tabClass(moreActive)}>
          <Menu className="size-5" aria-hidden />
          {t("more")}
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader>
            <SheetTitle>{t("more")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {more.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border bg-card text-sm",
                  isActivePath(pathname, item.href) &&
                    "border-primary text-primary",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {t(item.key)}
              </Link>
            ))}
            <button
              type="button"
              onClick={logout}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/30 bg-primary-soft text-primary text-sm"
            >
              <LogOut className="size-5" aria-hidden />
              {t("logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
