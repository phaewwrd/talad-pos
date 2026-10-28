import { locale } from "next/root-params";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function LocaleIndex() {
  const current = await locale();
  redirect({
    href: "/pos",
    locale: hasLocale(routing.locales, current)
      ? current
      : routing.defaultLocale,
  });
}
