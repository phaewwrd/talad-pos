import { bangkokDateParts } from "@/lib/time";

/** `YYMMDD` of the Bangkok calendar day. */
export function orderDateKey(date: Date) {
  const { year, month, day } = bangkokDateParts(date);
  return `${year.slice(2)}${month}${day}`;
}

/** `{prefix}-{YYMMDD}-{seq}`, seq zero-padded to 4 and reset daily. */
export function formatOrderNumber(prefix: string, date: Date, seq: number) {
  return `${prefix}-${orderDateKey(date)}-${String(seq).padStart(4, "0")}`;
}

/** Parse the sequence from an order number of the same prefix/day, else 0. */
export function parseOrderSeq(orderNumber: string) {
  const seq = Number(orderNumber.split("-").at(-1));
  return Number.isInteger(seq) ? seq : 0;
}
