"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { useLogout } from "@/components/shell/use-logout";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const logout = useLogout();
  const links = [
    { href: "/admin/invites", label: t("invites") },
    { href: "/admin/shops", label: t("shops") },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-sidebar px-4 text-white md:px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold">
          ต
        </span>
        <span className="hidden font-semibold sm:inline">{t("title")}</span>
        <nav className="ml-2 flex gap-1" aria-label={t("title")}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname.startsWith(l.href) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full px-4 text-sm text-sidebar-foreground",
                pathname.startsWith(l.href) &&
                  "bg-sidebar-accent text-sidebar-active",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-foreground">
          <LocaleSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-primary"
            onClick={logout}
            aria-label={t("logout")}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
