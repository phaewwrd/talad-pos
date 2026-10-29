import * as z from "zod";
import type { SupplierDisplayMode } from "@/db/schema";
import { uuid } from "@/lib/schemas";

export const DISPLAY_MODES = [
  "QUANTITY",
  "STATUS",
] as const satisfies readonly SupplierDisplayMode[];

export const supplierPinSchema = z
  .string()
  .regex(/^\d{4,6}$/, { error: "invalid" });

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(80, { error: "tooLong" }),
  contact: z
    .string()
    .trim()
    .max(200, { error: "tooLong" })
    .transform((v) => v || null),
});

export const updateSupplierSchema = supplierSchema.extend({
  supplierId: uuid,
});

export const supplierIdSchema = z.object({ supplierId: uuid });

export const supplierProductsSchema = z.object({
  supplierId: uuid,
  productIds: z.array(uuid).max(5000),
});

export const linkEnabledSchema = z.object({
  supplierId: uuid,
  isEnabled: z.boolean(),
});

export const linkPinSchema = z.object({
  supplierId: uuid,
  pin: supplierPinSchema,
});

export const linkDisplaySchema = z.object({
  supplierId: uuid,
  displayMode: z.enum(DISPLAY_MODES),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable(),
});

/** Public PIN form: the token comes from the URL, never trusted beyond lookup. */
export const verifyPinSchema = z.object({
  token: z.string().min(20).max(100),
  pin: supplierPinSchema,
});
