import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export const TIME_ZONE = "Asia/Bangkok";

async function readRootLocale() {
  try {
    return await rootLocale();
  } catch {
    // Server Actions / Route Handlers can't read root params; they return
    // error codes that the client translates, so the default is enough.
    return undefined;
  }
}

export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await readRootLocale());
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
