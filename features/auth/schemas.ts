import * as z from "zod";

// Zod messages are translation keys under `validation.*` (messages/*.json).
export const emailSchema = z.email({ error: "email" }).trim().toLowerCase();
export const passwordSchema = z
  .string()
  .min(8, { error: "passwordMin" })
  .max(128, { error: "tooLong" });
export const pinSchema = z.string().regex(/^\d{4,6}$/, { error: "pin" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "required" }),
});

export const inviteSignupSchema = z
  .object({
    token: z.string().min(16, { error: "required" }),
    name: z
      .string()
      .trim()
      .min(1, { error: "required" })
      .max(80, { error: "tooLong" }),
    shopName: z
      .string()
      .trim()
      .min(1, { error: "required" })
      .max(80, { error: "tooLong" }),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });
export type InviteSignupInput = z.infer<typeof inviteSignupSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });

export const trustDeviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(60, { error: "tooLong" }),
});
