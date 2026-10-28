import * as z from "zod";
import { ORDER_STATUSES } from "@/db/app-schema";
import { moneyString, uuid } from "@/lib/schemas";

export const SALES_CHANNELS = [
  "storefront",
  "shopee",
  "lineman",
  "grab",
] as const;
export const PAYMENT_METHODS = ["cash", "promptpay"] as const;

export const orderItemsSchema = z
  .array(
    z.object({
      productId: uuid,
      quantity: z.number().int().positive().max(9999),
    }),
  )
  .min(1)
  .max(100);

export const paymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cash"), cashReceived: moneyString }),
  z.object({ method: z.literal("promptpay") }),
]);
export type PaymentInput = z.infer<typeof paymentSchema>;

export const createOrderSchema = z.object({
  salesChannel: z.enum(SALES_CHANNELS),
  customerName: z.string().trim().max(80).default("Walk-in"),
  items: orderItemsSchema,
  excludedPromotionIds: z.array(uuid).max(50).default([]),
  /** Omit to leave the order Unpaid. */
  payment: paymentSchema.optional(),
});
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  orderId: uuid,
  customerName: z.string().trim().max(80),
  salesChannel: z.enum(SALES_CHANNELS),
  items: orderItemsSchema,
  excludedPromotionIds: z.array(uuid).max(50).default([]),
  reason: z.string().trim().max(200).optional(),
});
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;

export const changeStatusSchema = z.object({
  orderId: uuid,
  status: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(200).optional(),
});

export const takePaymentSchema = z.object({
  orderId: uuid,
  payment: paymentSchema,
});

export const reasonSchema = z.object({
  orderId: uuid,
  reason: z.string().trim().min(1).max(200),
});

export const orderFiltersSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  channel: z.enum(SALES_CHANNELS).optional(),
  paymentType: z.enum(["Paid", "Unpaid"]).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  staffId: uuid.optional(),
  q: z.string().trim().max(80).optional(),
  deleted: z.enum(["0", "1"]).optional(),
  active: z.enum(["0", "1"]).optional(),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
