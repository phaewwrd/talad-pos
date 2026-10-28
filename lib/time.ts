export const SHOP_TIME_ZONE = "Asia/Bangkok";

/** Calendar parts of `date` in Asia/Bangkok. */
export function bangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** `YYYY-MM-DD` in Asia/Bangkok. */
export function bangkokDateString(date: Date) {
  const { year, month, day } = bangkokDateParts(date);
  return `${year}-${month}-${day}`;
}

/** Start of the Bangkok calendar day containing `date`, as an absolute instant. */
export function startOfBangkokDay(date: Date) {
  // Bangkok has no DST: fixed UTC+7.
  return new Date(`${bangkokDateString(date)}T00:00:00+07:00`);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
