import * as z from "zod";
import { pinSchema } from "@/features/auth/schemas";
import { intFromInput, percentString, uuid } from "@/lib/schemas";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => v || null);

export const shopSettingsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(80, { error: "tooLong" }),
  logoUrl: z.url({ error: "invalid" }).nullable(),
  address: optionalText(300),
  phone: optionalText(30),
  taxId: z
    .string()
    .trim()
    .regex(/^(\d{13})?$/, { error: "invalid" })
    .transform((v) => v || null),
  // PromptPay: 10-digit mobile or 13-digit national/tax ID.
  promptpayId: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^(\d{10}|\d{13})$/.test(v), {
      error: "invalid",
    })
    .transform((v) => v || null),
  orderNumberPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{1,6}$/, { error: "invalid" }),
  receiptHeader: optionalText(300),
  receiptFooter: optionalText(300),
  expiryAlertDays: intFromInput(),
});

export const taxSettingsSchema = z.object({
  vatEnabled: z.boolean(),
  vatMode: z.enum(["inclusive", "exclusive"]),
  vatRate: percentString,
  serviceChargeEnabled: z.boolean(),
  serviceChargeRate: percentString,
});

export const STAFF_ROLES = ["manager", "cashier"] as const;

export const createStaffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(60, { error: "tooLong" }),
  role: z.enum(STAFF_ROLES),
  pin: pinSchema,
});

export const resetPinSchema = z.object({ userId: uuid, pin: pinSchema });
export const updateStaffSchema = z.object({
  userId: uuid,
  role: z.enum(STAFF_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const createShopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(80, { error: "tooLong" }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "required" }),
    newPassword: z
      .string()
      .min(8, { error: "passwordMin" })
      .max(128, { error: "tooLong" }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });
