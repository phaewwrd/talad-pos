import * as z from "zod";
import { intFromInput, moneyString, uuid } from "@/lib/schemas";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(60, { error: "tooLong" }),
});

export const reorderCategoriesSchema = z.object({ ids: z.array(uuid).min(1) });

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(120, { error: "tooLong" }),
  sku: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(40, { error: "tooLong" })
    .regex(/^[\w.-]+$/, { error: "invalid" }),
  categoryId: uuid,
  price: moneyString,
  // Hidden for non-owners in the UI; server keeps the existing value then.
  cost: moneyString.optional(),
  minimumStock: intFromInput(),
  isActive: z.boolean(),
  imageUrl: z.url({ error: "invalid" }).nullable(),
});
export type ProductInput = z.input<typeof productSchema>;
