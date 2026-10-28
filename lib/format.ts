"use client";

import { useFormatter, useLocale } from "next-intl";
import { useMemo } from "react";
import { SHOP_TIME_ZONE } from "@/lib/time";

/** ฿1,234.00 in the current locale (money strings never go through floats for math). */
export function useMoney() {
  const locale = useLocale();
  return useMemo(() => {
    const fmt = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    });
    // Display only: values are already rounded 2dp strings.
    return (value: string | number | null | undefined) =>
      fmt.format(Number(value ?? 0));
  }, [locale]);
}

export function useDateTime() {
  const format = useFormatter();
  return {
    dateTime: (d: Date | string) =>
      format.dateTime(new Date(d), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: SHOP_TIME_ZONE,
      }),
    date: (d: Date | string) =>
      format.dateTime(new Date(d), {
        dateStyle: "medium",
        timeZone: SHOP_TIME_ZONE,
      }),
    time: (d: Date | string) =>
      format.dateTime(new Date(d), {
        timeStyle: "short",
        timeZone: SHOP_TIME_ZONE,
      }),
  };
}
