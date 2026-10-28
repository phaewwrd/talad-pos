import * as z from "zod";
import { moneyString, uuid } from "@/lib/schemas";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "invalid" });

export const promotionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "required" })
      .max(120, { error: "tooLong" }),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: moneyString.refine((v) => Number(v) > 0, {
      error: "positive",
    }),
    minimumType: z.enum(["quantity", "amount"]),
    minimumQuantity: z.coerce
      .number({ error: "number" })
      .int({ error: "integer" })
      .min(1, { error: "positive" }),
    minimumAmount: moneyString.or(z.literal("")).transform((v) => v || null),
    /** datetime-local values interpreted in Asia/Bangkok. */
    startAt: localDateTime,
    endAt: localDateTime,
    isActive: z.boolean(),
    productIds: z.array(uuid).max(500),
    categoryIds: z.array(uuid).max(100),
  })
  .refine(
    (v) => v.discountType !== "percentage" || Number(v.discountValue) <= 100,
    {
      error: "percent",
      path: ["discountValue"],
    },
  )
  .refine((v) => v.minimumType !== "amount" || v.minimumAmount !== null, {
    error: "required",
    path: ["minimumAmount"],
  })
  .refine((v) => v.endAt >= v.startAt, { error: "dateRange", path: ["endAt"] })
  .refine((v) => v.productIds.length + v.categoryIds.length > 0, {
    error: "targetRequired",
    path: ["productIds"],
  });
export type PromotionInput = z.input<typeof promotionSchema>;
