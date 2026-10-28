"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import type { MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { isActivePath, navItemsFor } from "./nav-items";
import { useLogout } from "./use-logout";

export function AppSidebar({ role }: { role: MemberRole }) {
  const items = navItemsFor(role);
  const t = useTranslations("nav");
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center bg-sidebar py-4 md:flex">
      <Link
        href="/pos"
        className="mb-6 flex size-11 items-center justify-center rounded-2xl bg-primary font-bold text-lg text-white"
        aria-label="Talad POS"
      >
        ต
      </Link>
      <nav
        aria-label={t("mainNavigation")}
        className="flex flex-1 flex-col gap-2"
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={t(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex size-12 items-center justify-center rounded-2xl text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white",
                    active && "bg-sidebar-accent text-sidebar-active",
                  )}
                >
                  {active && (
                    <span className="-left-4 absolute h-6 w-1 rounded-r-full bg-sidebar-active" />
                  )}
                  <item.icon className="size-5" aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t(item.key)}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={logout}
            aria-label={t("logout")}
            className="flex size-12 items-center justify-center rounded-2xl text-primary transition-colors hover:bg-primary/15"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("logout")}</TooltipContent>
      </Tooltip>
    </aside>
  );
}
