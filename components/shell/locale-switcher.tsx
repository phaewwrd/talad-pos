"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type AppLocale, routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <ToggleGroup
      type="single"
      value={locale}
      aria-label={t("language")}
      disabled={pending}
      onValueChange={(next) => {
        if (!next || next === locale) return;
        startTransition(() => {
          router.replace(
            {
              pathname,
              query: Object.fromEntries(
                new URLSearchParams(window.location.search),
              ),
            },
            { locale: next as AppLocale },
          );
        });
      }}
      className="rounded-full border bg-card p-0.5"
    >
      {routing.locales.map((l) => (
        <ToggleGroupItem
          key={l}
          value={l}
          className="h-8 rounded-full px-3 text-xs uppercase data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {l}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
