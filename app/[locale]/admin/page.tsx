import { locale } from "next/root-params";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function AdminIndex() {
  const l = await locale();
  redirect({
    href: "/admin/invites",
    locale: hasLocale(routing.locales, l) ? l : routing.defaultLocale,
  });
}
