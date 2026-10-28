"use client";

import { Check, ChevronDown, UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { LocaleSwitcher } from "./locale-switcher";
import type { ShellSession } from "./shell-types";
import { useLogout } from "./use-logout";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function TopBar({ session }: { session: ShellSession }) {
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const router = useRouter();
  const logout = useLogout();
  const { activeShop, shops, user, role } = session;

  // Shift change: end this staff session and go straight back to the PIN pad.
  async function switchUser() {
    await authClient.signOut();
    router.replace("/pin");
    router.refresh();
  }

  async function switchShop(organizationId: string) {
    if (organizationId === activeShop.id) return;
    await authClient.organization.setActive({ organizationId });
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full pr-2 text-left"
          aria-label={t("switchShop")}
          disabled={shops.length < 2}
        >
          <Avatar className="size-9 rounded-xl">
            {activeShop.logoUrl && (
              <AvatarImage src={activeShop.logoUrl} alt="" />
            )}
            <AvatarFallback className="rounded-xl bg-gold-soft font-semibold text-gold-text">
              {initials(activeShop.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-semibold">{activeShop.name}</span>
          {shops.length > 1 && (
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>{t("switchShop")}</DropdownMenuLabel>
          {shops.map((shop) => (
            <DropdownMenuItem
              key={shop.id}
              onSelect={() => switchShop(shop.id)}
            >
              <span className="flex-1 truncate">{shop.name}</span>
              {shop.id === activeShop.id && (
                <Check className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-full pl-1">
            <Avatar className="size-9">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="bg-foreground text-background text-xs">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col text-left leading-tight sm:flex">
              <span className="max-w-32 truncate font-medium text-sm">
                {user.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {tRoles(role)}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="sm:hidden">
              {user.name} · {tRoles(role)}
            </DropdownMenuLabel>
            {session.isPinSession && (
              <DropdownMenuItem onSelect={switchUser}>
                <UserRoundCog className="size-4" /> {t("switchUser")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={logout}>
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
