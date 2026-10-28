"use client";

import {
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBackofficeLogout } from "@/features/backoffice/auth/components/use-backoffice-nav";
import { Link, usePathname } from "@/i18n/navigation";
import { type Capability, can } from "@/lib/backoffice/permissions";
import { cn } from "@/lib/utils";
import { BackofficeBrand } from "./backoffice-brand";
import {
  BackofficeProvider,
  type BackofficeViewer,
} from "./backoffice-context";
import { RoleChip } from "./role-chip";

const NAV = [
  { href: "/backoffice", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/backoffice/shops", key: "shops", icon: Store },
  { href: "/backoffice/owners", key: "owners", icon: UserRound },
  { href: "/backoffice/invites", key: "invites", icon: Mail },
  { href: "/backoffice/audit-log", key: "auditLog", icon: ScrollText },
  {
    href: "/backoffice/team",
    key: "team",
    icon: UsersRound,
    capability: "team.view" as Capability,
  },
] as const;

function NavLinks({
  viewer,
  onNavigate,
}: {
  viewer: BackofficeViewer;
  onNavigate?: () => void;
}) {
  const t = useTranslations("backoffice.nav");
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {NAV.filter(
        (item) => !("capability" in item) || can(viewer.role, item.capability),
      ).map((item) => {
        const active =
          "exact" in item
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 font-medium text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white",
                active && "bg-sidebar-accent text-sidebar-active",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({ viewer }: { viewer: BackofficeViewer }) {
  const t = useTranslations("backoffice");
  const logout = useBackofficeLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 items-center gap-2 rounded-full px-2 text-white hover:bg-white/10"
        aria-label={t("userMenu.open")}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-gold font-semibold text-sm text-topbar">
          {viewer.user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="max-w-40 truncate font-medium text-sm">
            {viewer.user.name}
          </span>
          <RoleChip role={viewer.role} className="h-4 px-1.5 text-[10px]" />
        </span>
        <ChevronDown className="size-4 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-1">
          <span className="truncate">{viewer.user.name}</span>
          <span className="truncate font-normal text-muted-foreground text-xs">
            {viewer.user.email}
          </span>
          <RoleChip
            role={viewer.role}
            className="w-fit border-gold-text text-gold-text"
          />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/backoffice/change-password">
            <KeyRound className="size-4" /> {t("userMenu.changePassword")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut className="size-4" /> {t("userMenu.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BackofficeShell({
  viewer,
  children,
}: {
  viewer: BackofficeViewer;
  children: React.ReactNode;
}) {
  const t = useTranslations("backoffice.nav");
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <BackofficeProvider viewer={viewer}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 bg-topbar px-3 md:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-white hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="size-5" />
          </Button>
          <Link href="/backoffice" aria-label={t("dashboard")}>
            <BackofficeBrand />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <UserMenu viewer={viewer} />
          </div>
        </header>
        <div className="flex flex-1">
          <nav
            aria-label={t("label")}
            className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto bg-topbar p-3 lg:block"
          >
            <NavLinks viewer={viewer} />
          </nav>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent
            side="left"
            className="w-72 border-sidebar-border bg-topbar p-3 text-white"
          >
            <SheetHeader className="px-1 pb-4">
              <SheetTitle className="text-white">
                <BackofficeBrand />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label={t("label")}>
              <NavLinks viewer={viewer} onNavigate={() => setMenuOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </BackofficeProvider>
  );
}
