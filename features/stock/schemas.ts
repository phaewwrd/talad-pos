import * as z from "zod";
import { dateString, intFromInput, moneyString, uuid } from "@/lib/schemas";

export const stockInSchema = z
  .object({
    productId: uuid,
    lotNumber: z
      .string()
      .trim()
      .min(1, { error: "required" })
      .max(40, { error: "tooLong" }),
    stockInDate: dateString,
    expiryDate: dateString.or(z.literal("")).transform((v) => v || null),
    quantity: intFromInput({ min: 1 }),
    unitCost: moneyString,
  })
  .refine((v) => !v.expiryDate || v.expiryDate >= v.stockInDate, {
    error: "dateRange",
    path: ["expiryDate"],
  });
export type StockInInput = z.input<typeof stockInSchema>;

export const ADJUSTMENT_TYPES = ["adjust_up", "adjust_down", "waste"] as const;

export const adjustStockSchema = z.object({
  productId: uuid,
  lotId: uuid,
  type: z.enum(ADJUSTMENT_TYPES),
  quantity: intFromInput({ min: 1 }),
  reason: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(200, { error: "tooLong" }),
});
export type AdjustStockInput = z.input<typeof adjustStockSchema>;
