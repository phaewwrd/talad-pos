"use client";

import { useTranslations } from "next-intl";
import { useLogout } from "@/components/shell/use-logout";
import { Button } from "@/components/ui/button";

export function ShopUnavailableActions() {
  const t = useTranslations("nav");
  const logout = useLogout();
  return (
    <Button className="h-12 w-full rounded-full" onClick={logout}>
      {t("logout")}
    </Button>
  );
}
