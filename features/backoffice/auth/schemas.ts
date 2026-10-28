import * as z from "zod";
import { emailSchema } from "@/features/auth/schemas";

// Zod messages are translation keys under `validation.*`.
export const backofficeLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "required" }).max(128),
});

/** Backoffice passwords: 12+ characters. */
export const backofficePasswordSchema = z
  .string()
  .min(12, { error: "passwordMin12" })
  .max(128, { error: "tooLong" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "required" }),
    newPassword: backofficePasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    error: "passwordReused",
    path: ["newPassword"],
  });

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: "totp" });

export const verifyTwoFactorSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("totp"), code: totpCodeSchema }),
  z.object({
    method: z.literal("backup"),
    code: z.string().trim().min(6, { error: "required" }).max(32),
  }),
]);

export const startTwoFactorSchema = z.object({
  password: z.string().min(1, { error: "required" }),
});
export const confirmTwoFactorSchema = z.object({ code: totpCodeSchema });

export type BackofficeNextStep =
  | "console"
  | "change-password"
  | "setup-2fa"
  | "verify-2fa";
