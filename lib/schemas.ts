import * as z from "zod";

/** Non-negative baht amount as a 2dp-max string (DB numeric(12,2)). */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, { error: "money" });

export const percentString = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, { error: "percent" })
  .refine((v) => Number(v) <= 100, { error: "percent" });

export const intFromInput = (opts: { min?: number } = {}) =>
  z.coerce
    .number({ error: "number" })
    .int({ error: "integer" })
    .min(opts.min ?? 0, {
      error: opts.min && opts.min > 0 ? "positive" : "nonNegative",
    });

export const dateString = z.iso.date({ error: "invalid" });
export const uuid = z.uuid({ error: "invalid" });
