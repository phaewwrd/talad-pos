import { addDays, bangkokDateString } from "@/lib/time";

export type RangePreset = "today" | "7d" | "month" | "custom";
export type Grouping = "day" | "week" | "month";
export type DateRange = { from: string; to: string }; // inclusive Bangkok dates

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function daysBetween(range: DateRange) {
  return (
    Math.round(
      (day(range.to).getTime() - day(range.from).getTime()) / 86_400_000,
    ) + 1
  );
}

export function resolveRange(
  preset: RangePreset,
  now: Date,
  custom?: Partial<DateRange>,
): DateRange {
  const today = bangkokDateString(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: bangkokDateString(addDays(now, -6)), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "custom": {
      const from = custom?.from ?? today;
      const to = custom?.to ?? from;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** The equally long period immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const n = daysBetween(range);
  const to = new Date(day(range.from).getTime() - 86_400_000);
  const from = new Date(to.getTime() - (n - 1) * 86_400_000);
  return { from: iso(from), to: iso(to) };
}

/** Bucket key matching Postgres date_trunc (week starts Monday). */
export function bucketKey(date: string, grouping: Grouping) {
  if (grouping === "day") return date;
  if (grouping === "month") return `${date.slice(0, 8)}01`;
  const d = day(date);
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  return iso(new Date(d.getTime() - offset * 86_400_000));
}

export function bucketsFor(range: DateRange, grouping: Grouping) {
  const keys: string[] = [];
  for (
    let d = day(range.from);
    iso(d) <= range.to;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const key = bucketKey(iso(d), grouping);
    if (keys.at(-1) !== key) keys.push(key);
  }
  return keys;
}
