import { locale } from "next/root-params";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The old platform admin moved to the Backoffice.
export default async function LegacyAdminRedirect() {
  const current = await locale();
  redirect({
    href: "/backoffice",
    locale: hasLocale(routing.locales, current)
      ? current
      : routing.defaultLocale,
  });
}
