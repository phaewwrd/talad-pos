import * as z from "zod";
import { LIMIT_MAX } from "@/lib/backoffice/presets";

// Zod messages are translation keys under `validation.*`.
const limit = (max: number) =>
  z
    .number({ error: "number" })
    .int({ error: "integer" })
    .min(1, { error: "positive" })
    .max(max, { error: "tooLarge" })
    .nullable();

/** `null` = unlimited. */
export const limitsSchema = z.object({
  maxShops: limit(LIMIT_MAX.maxShops),
  maxStaffPerShop: limit(LIMIT_MAX.maxStaffPerShop),
  maxProducts: limit(LIMIT_MAX.maxProducts),
});

export const featuresSchema = z.object({
  promotions: z.boolean(),
  costProfit: z.boolean(),
  export: z.boolean(),
  platformChannels: z.boolean(),
  multiShop: z.boolean(),
});

export const reasonSchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .max(500, { error: "tooLong" });

/** Form representation of one limit: a string input plus an unlimited toggle. */
export type LimitField = { value: string; unlimited: boolean };

export function toLimitField(v: number | null): LimitField {
  return v === null
    ? { value: "", unlimited: true }
    : { value: String(v), unlimited: false };
}

export function fromLimitField(f: LimitField): number | null {
  if (f.unlimited) return null;
  const n = Number(f.value.trim());
  return f.value.trim() === "" || !Number.isFinite(n) ? Number.NaN : n;
}
