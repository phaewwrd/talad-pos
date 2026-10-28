import * as z from "zod";
import {
  dateString,
  intFromInput,
  moneyString,
  percentString,
  uuid,
} from "@/lib/schemas";

export const COST_PROFIT_CHANNELS = ["shopee", "lineman", "other"] as const;

export const entrySchema = z.object({
  entryDate: dateString,
  salesChannel: z.enum(COST_PROFIT_CHANNELS),
  productId: uuid.or(z.literal("")).transform((v) => v || null),
  productName: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(120, { error: "tooLong" }),
  quantity: intFromInput({ min: 1 }),
  unitCost: moneyString,
  unitPrice: moneyString,
  platformFeeRate: percentString,
});
export type EntryInput = z.input<typeof entrySchema>;
